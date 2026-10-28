import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, SQL } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import type { UserRole } from '../common/decorators/roles.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { definedOnly } from '../common/utils/object.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { users } from '../database/schema/index.js';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  UpdateStaffDto,
} from './dto/staff.dto.js';

// password_hash is never selected.
const staffColumns = {
  id: users.id,
  role: users.role,
  fullName: users.fullName,
  email: users.email,
  phone: users.phone,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

type Staff = Awaited<ReturnType<StaffService['get']>>;

// A staff id from another business is reported exactly like a missing one,
// so ids cannot be probed across tenants.
const notFound = () =>
  new NotFoundException(errorBody('STAFF_NOT_FOUND', 'Staff member not found'));
const secondOwner = () =>
  new ConflictException(
    errorBody(
      'SECOND_OWNER',
      'A business has exactly one owner; another owner cannot be added',
    ),
  );
const ownerProtected = () =>
  new ForbiddenException(
    errorBody(
      'OWNER_PROTECTED',
      'The owner cannot be deactivated or have their role changed',
    ),
  );
const roleNotAllowed = (role: UserRole) =>
  new ForbiddenException(
    errorBody('ROLE_NOT_ALLOWED', `You cannot assign the ${role} role`),
  );
const notManageable = () =>
  new ForbiddenException(
    errorBody(
      'STAFF_NOT_MANAGEABLE',
      'You do not have permission to manage this staff member',
    ),
  );
const emailTaken = () =>
  new ConflictException(
    errorBody('EMAIL_TAKEN', 'This email is already in use'),
  );

/** Roles each actor may create or assign. Nobody may assign 'owner'. */
const ASSIGNABLE: Record<UserRole, UserRole[]> = {
  owner: ['manager', 'salesman'],
  manager: ['salesman'],
  salesman: [],
};

@Injectable()
export class StaffService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(actor: StaffTokenPayload, query: ListStaffQueryDto) {
    const filters: SQL[] = [eq(users.businessId, actor.businessId)];
    if (query.role) filters.push(eq(users.role, query.role));
    if (query.isActive !== undefined) {
      filters.push(eq(users.isActive, query.isActive));
    }
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(staffColumns)
        .from(users)
        .where(where)
        .orderBy(asc(users.fullName), asc(users.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(users).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  async get(actor: StaffTokenPayload, id: string) {
    const [row] = await this.db
      .select(staffColumns)
      .from(users)
      .where(and(eq(users.id, id), eq(users.businessId, actor.businessId)));
    if (!row) throw notFound();
    return row;
  }

  async create(actor: StaffTokenPayload, dto: CreateStaffDto) {
    this.assertAssignable(actor, dto.role);
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          id: randomUUID(),
          businessId: actor.businessId,
          role: dto.role,
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          passwordHash: await hashPassword(dto.password),
          createdAt: new Date(),
        })
        .returning(staffColumns);
      return row;
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  async update(actor: StaffTokenPayload, id: string, dto: UpdateStaffDto) {
    const target = await this.get(actor, id);
    const changes = definedOnly(dto);

    if (target.role === 'owner') {
      // Only the owner edits the owner, and only their contact details.
      if (actor.sub !== target.id) throw notManageable();
      if (changes.role !== undefined && changes.role !== 'owner') {
        throw ownerProtected();
      }
      if (changes.isActive === false) throw ownerProtected();
      delete changes.role;
      delete changes.isActive;
    } else {
      this.assertManageable(actor, target);
      if (changes.role !== undefined && changes.role !== target.role) {
        this.assertAssignable(actor, changes.role);
      }
    }

    if (Object.keys(changes).length === 0) return target;
    try {
      const [row] = await this.db
        .update(users)
        .set(changes)
        .where(and(eq(users.id, id), eq(users.businessId, actor.businessId)))
        .returning(staffColumns);
      return row;
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  // Existing tokens are not revoked by a reset (no token table yet; see the
  // refresh-token TODO in AuthService). Deactivation does revoke them.
  async resetPassword(
    actor: StaffTokenPayload,
    id: string,
    temporaryPassword: string,
  ): Promise<void> {
    const target = await this.get(actor, id);
    // Your own password goes through /auth/change-password, which checks the
    // current one. That also keeps the owner's password out of reach here.
    if (target.id === actor.sub || target.role === 'owner') {
      throw notManageable();
    }
    this.assertManageable(actor, target);
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(temporaryPassword) })
      .where(and(eq(users.id, id), eq(users.businessId, actor.businessId)));
  }

  private assertAssignable(actor: StaffTokenPayload, role: UserRole): void {
    if (role === 'owner') throw secondOwner();
    if (!ASSIGNABLE[actor.role].includes(role)) throw roleNotAllowed(role);
  }

  /** Owners manage managers and salesmen; managers manage salesmen. */
  private assertManageable(actor: StaffTokenPayload, target: Staff): void {
    if (!ASSIGNABLE[actor.role].includes(target.role)) throw notManageable();
  }
}

function translateUniqueViolation(err: unknown): unknown {
  if (isUniqueViolation(err, 'users_email_unique')) return emailTaken();
  // Backstop for the role checks above: the one-owner index.
  if (isUniqueViolation(err, 'idx_users_one_owner_per_business')) {
    return secondOwner();
  }
  return err;
}
