import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type {
  ShopTokenPayload,
  StaffTokenPayload,
  TokenPayload,
} from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import type { AppConfigService } from '../config/app-config.module.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { businesses, retailClients, users } from '../database/schema/index.js';
import { checkPassword, hashPassword, verifyPassword } from './password.js';

// One message for unknown email and wrong password, so login cannot be used
// to discover which accounts exist.
const invalidCredentials = () =>
  new UnauthorizedException(
    errorBody('INVALID_CREDENTIALS', 'Invalid email or password'),
  );
const accountInactive = () =>
  new ForbiddenException(
    errorBody('ACCOUNT_INACTIVE', 'This account has been deactivated'),
  );
const wrongCurrentPassword = () =>
  new UnauthorizedException(
    errorBody('INVALID_CREDENTIALS', 'Current password is incorrect'),
  );

// Explicit column lists: password_hash is never selected into a profile.
const staffColumns = {
  id: users.id,
  role: users.role,
  fullName: users.fullName,
  email: users.email,
  phone: users.phone,
  lastLoginAt: users.lastLoginAt,
  business: { id: businesses.id, name: businesses.name },
};
const shopColumns = {
  id: retailClients.id,
  name: retailClients.name,
  ownerName: retailClients.ownerName,
  email: retailClients.email,
  phone: retailClients.phone,
  address: retailClients.address,
  panNumber: retailClients.panNumber,
  lastLoginAt: retailClients.lastLoginAt,
  business: { id: businesses.id, name: businesses.name },
};

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  profile: Profile;
}

export type Profile = Awaited<ReturnType<AuthService['getProfile']>>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  async staffLogin(email: string, password: string): Promise<LoginResult> {
    const [row] = await this.db
      .select({
        id: users.id,
        role: users.role,
        businessId: users.businessId,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        businessActive: businesses.isActive,
      })
      .from(users)
      .innerJoin(businesses, eq(businesses.id, users.businessId))
      .where(eq(users.email, email));

    if (!(await checkPassword(row?.passwordHash, password))) {
      throw invalidCredentials();
    }
    if (!row.isActive || !row.businessActive) throw accountInactive();

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, row.id));
    return this.issue({
      type: 'staff',
      sub: row.id,
      role: row.role,
      businessId: row.businessId,
    });
  }

  async shopLogin(email: string, password: string): Promise<LoginResult> {
    const [row] = await this.db
      .select({
        id: retailClients.id,
        passwordHash: retailClients.passwordHash,
        isActive: retailClients.isActive,
        businessActive: businesses.isActive,
      })
      .from(retailClients)
      .innerJoin(businesses, eq(businesses.id, retailClients.businessId))
      .where(eq(retailClients.email, email));

    if (!(await checkPassword(row?.passwordHash, password))) {
      throw invalidCredentials();
    }
    if (!row.isActive || !row.businessActive) throw accountInactive();

    await this.db
      .update(retailClients)
      .set({ lastLoginAt: new Date() })
      .where(eq(retailClients.id, row.id));
    return this.issue({ type: 'shop', sub: row.id });
  }

  /**
   * Re-reads a token's subject so a deactivated account, shop or business
   * loses access immediately rather than when the token expires. Returns the
   * payload with the current role, or null if the subject may not proceed.
   */
  async resolvePrincipal(token: TokenPayload): Promise<TokenPayload | null> {
    if (token.type === 'staff') {
      const [row] = await this.db
        .select({
          role: users.role,
          businessId: users.businessId,
          isActive: users.isActive,
          businessActive: businesses.isActive,
        })
        .from(users)
        .innerJoin(businesses, eq(businesses.id, users.businessId))
        .where(eq(users.id, token.sub));
      if (!row?.isActive || !row.businessActive) return null;
      return {
        type: 'staff',
        sub: token.sub,
        role: row.role,
        businessId: row.businessId,
      };
    }

    const [row] = await this.db
      .select({
        isActive: retailClients.isActive,
        businessActive: businesses.isActive,
      })
      .from(retailClients)
      .innerJoin(businesses, eq(businesses.id, retailClients.businessId))
      .where(eq(retailClients.id, token.sub));
    if (!row?.isActive || !row.businessActive) return null;
    return { type: 'shop', sub: token.sub };
  }

  async getProfile(principal: TokenPayload) {
    if (principal.type === 'staff') {
      const [row] = await this.db
        .select(staffColumns)
        .from(users)
        .innerJoin(businesses, eq(businesses.id, users.businessId))
        .where(eq(users.id, principal.sub));
      return { type: 'staff' as const, ...row };
    }
    const [row] = await this.db
      .select(shopColumns)
      .from(retailClients)
      .innerJoin(businesses, eq(businesses.id, retailClients.businessId))
      .where(eq(retailClients.id, principal.sub));
    return { type: 'shop' as const, ...row };
  }

  async changePassword(
    principal: TokenPayload,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const table = principal.type === 'staff' ? users : retailClients;
    const [row] = await this.db
      .select({ passwordHash: table.passwordHash })
      .from(table)
      .where(eq(table.id, principal.sub));
    if (!row || !(await verifyPassword(row.passwordHash, currentPassword))) {
      throw wrongCurrentPassword();
    }
    // Tokens issued before the change stay valid until they expire; revoking
    // them needs server-side token state (see the refresh-token TODO on issue()).
    await this.db
      .update(table)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(table.id, principal.sub));
  }

  // TODO: refresh tokens need a table. Until one exists there is a single
  // access token (JWT_EXPIRY, default 1d), no refresh endpoint and no
  // server-side revocation. Do not fake one with an in-memory store.
  private async issue(
    payload: StaffTokenPayload | ShopTokenPayload,
  ): Promise<LoginResult> {
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRY', { infer: true }),
      profile: await this.getProfile(payload),
    };
  }
}
