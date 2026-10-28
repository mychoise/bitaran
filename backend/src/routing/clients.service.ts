import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { definedOnly } from '../common/utils/object.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { likeContains } from '../common/utils/search.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import {
  businesses,
  retailClients,
  routeClients,
} from '../database/schema/index.js';
import {
  CreateClientDto,
  ListClientsQueryDto,
  MANAGER_ONLY_CLIENT_FIELDS,
  UpdateClientDto,
} from './dto/client.dto.js';

// password_hash is never selected.
export const clientColumns = {
  id: retailClients.id,
  name: retailClients.name,
  ownerName: retailClients.ownerName,
  email: retailClients.email,
  phone: retailClients.phone,
  address: retailClients.address,
  panNumber: retailClients.panNumber,
  panCardImageKey: retailClients.panCardImageKey,
  registrationNumber: retailClients.registrationNumber,
  lat: retailClients.lat,
  lng: retailClients.lng,
  creditLimitPaisa: retailClients.creditLimitPaisa,
  openingBalancePaisa: retailClients.openingBalancePaisa,
  isActive: retailClients.isActive,
  lastLoginAt: retailClients.lastLoginAt,
  createdAt: retailClients.createdAt,
};

// Another business's shop is reported exactly like a missing one.
export const clientNotFound = () =>
  new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found'));
const emailTaken = () =>
  new ConflictException(
    errorBody('EMAIL_TAKEN', 'A shop with this email already exists'),
  );
const panTaken = () =>
  new ConflictException(
    errorBody('PAN_TAKEN', 'Another shop in this business has this PAN number'),
  );
const managerOnly = (fields: string[]) =>
  new ForbiddenException(
    errorBody(
      'FIELD_NOT_ALLOWED',
      `Only managers and owners can change: ${fields.join(', ')}`,
      fields,
    ),
  );

@Injectable()
export class ClientsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(actor: StaffTokenPayload, query: ListClientsQueryDto) {
    const filters: (SQL | undefined)[] = [
      eq(retailClients.businessId, actor.businessId),
    ];
    if (query.search) {
      const p = likeContains(query.search);
      filters.push(
        or(
          ilike(retailClients.name, p),
          ilike(retailClients.ownerName, p),
          ilike(retailClients.phone, p),
          ilike(retailClients.email, p),
          ilike(retailClients.panNumber, p),
        ),
      );
    }
    if (query.isActive !== undefined) {
      filters.push(eq(retailClients.isActive, query.isActive));
    }
    const where = and(...filters);

    if (query.routeId) {
      // Route filter: shops in visiting order. The route itself need not be
      // checked for ownership, since the shops are already scoped to this
      // business; another business's route simply matches nothing.
      const onRoute = and(where, eq(routeClients.routeId, query.routeId));
      const [rows, [{ total }]] = await Promise.all([
        this.db
          .select(clientColumns)
          .from(retailClients)
          .innerJoin(routeClients, eq(routeClients.clientId, retailClients.id))
          .where(onRoute)
          .orderBy(asc(routeClients.sequence))
          .limit(query.limit)
          .offset(getOffset(query)),
        this.db
          .select({ total: count() })
          .from(retailClients)
          .innerJoin(routeClients, eq(routeClients.clientId, retailClients.id))
          .where(onRoute),
      ]);
      return buildPaginatedResult(rows, total, query);
    }

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(clientColumns)
        .from(retailClients)
        .where(where)
        .orderBy(asc(retailClients.name), asc(retailClients.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(retailClients).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  async get(businessId: string, id: string) {
    const [row] = await this.db
      .select(clientColumns)
      .from(retailClients)
      .where(owned(businessId, id));
    if (!row) throw clientNotFound();
    return row;
  }

  async create(actor: StaffTokenPayload, dto: CreateClientDto) {
    const { password, ...fields } = definedOnly(dto);
    if (actor.role === 'salesman') {
      // A salesman registers a shop on the spot; money terms are set later
      // by a manager or owner, whatever the salesman sent.
      fields.creditLimitPaisa = 0;
      fields.openingBalancePaisa = 0;
      fields.isActive = true;
    }
    try {
      const [row] = await this.db
        .insert(retailClients)
        .values({
          ...fields,
          name: dto.name,
          email: dto.email,
          id: randomUUID(),
          businessId: actor.businessId,
          passwordHash: await hashPassword(password!),
          createdAt: new Date(),
        })
        .returning(clientColumns);
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  async update(actor: StaffTokenPayload, id: string, dto: UpdateClientDto) {
    const changes = definedOnly(dto);
    if (actor.role === 'salesman') {
      const refused = MANAGER_ONLY_CLIENT_FIELDS.filter(
        (f) => changes[f] !== undefined,
      );
      if (refused.length) throw managerOnly(refused);
    }
    if (Object.keys(changes).length === 0) {
      return this.get(actor.businessId, id);
    }
    try {
      const [row] = await this.db
        .update(retailClients)
        .set(changes)
        .where(owned(actor.businessId, id))
        .returning(clientColumns);
      if (!row) throw clientNotFound();
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  // Existing tokens are not revoked by a reset (no token table yet; see the
  // refresh-token TODO in AuthService). Deactivation does revoke them.
  async resetPassword(
    businessId: string,
    id: string,
    temporaryPassword: string,
  ): Promise<void> {
    const [row] = await this.db
      .update(retailClients)
      .set({ passwordHash: await hashPassword(temporaryPassword) })
      .where(owned(businessId, id))
      .returning({ id: retailClients.id });
    if (!row) throw clientNotFound();
  }

  /** A logged-in shop's own record. The id comes only from its token. */
  async getOwn(clientId: string) {
    const [row] = await this.db
      .select({
        ...clientColumns,
        business: { id: businesses.id, name: businesses.name },
      })
      .from(retailClients)
      .innerJoin(businesses, eq(businesses.id, retailClients.businessId))
      .where(eq(retailClients.id, clientId));
    return row;
  }
}

function owned(businessId: string, id: string) {
  return and(
    eq(retailClients.id, id),
    eq(retailClients.businessId, businessId),
  );
}

function translate(err: unknown): unknown {
  if (isUniqueViolation(err, 'retail_clients_email_unique')) {
    return emailTaken();
  }
  if (isUniqueViolation(err, 'idx_retail_clients_business_pan')) {
    return panTaken();
  }
  return err;
}
