import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, desc, inArray, gte, lte, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  users,
  memberships,
  roles,
  auditLogs,
  refreshTokens,
} from '../../db/schema';
import { canManage } from './team.constants';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TeamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auditService: AuditService,
  ) {}

  async listTeamMembers(orgId: string, actorRole: string) {
    const allowedRoles = actorRole === 'OWNER' ? ['MANAGER', 'STAFF'] : ['STAFF'];

    const members = await this.db
      .select({
        id: memberships.id,
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: roles.name,
        status: memberships.status,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(
        and(
          eq(memberships.orgId, orgId),
          inArray(roles.name, allowedRoles),
        ),
      )
      .orderBy(desc(memberships.createdAt));

    return members;
  }

  async createTeamMember(
    orgId: string,
    actorUserId: string,
    actorRole: string,
    dto: CreateTeamMemberDto,
  ) {
    if (dto.role as string === 'OWNER') {
      throw new ForbiddenException('Cannot create an OWNER');
    }

    // Hierarchy rule: actor must outrank the role being created
    if (!canManage(actorRole, dto.role)) {
      throw new ForbiddenException(
        `Your role (${actorRole}) cannot create a ${dto.role}`,
      );
    }

    const cleanEmail = dto.email.trim().toLowerCase();

    // Check if email already belongs to a user
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${cleanEmail}`)
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const [targetRole] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, dto.role))
      .limit(1);

    if (!targetRole) {
      throw new BadRequestException(`Role ${dto.role} not found`);
    }

    // Generate random temporary password (at least 10 characters)
    const tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const result = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: dto.name.trim(),
          email: cleanEmail,
          passwordHash,
          mustChangePassword: true,
          status: 'ACTIVE',
        })
        .returning();

      const [newMembership] = await tx
        .insert(memberships)
        .values({
          userId: newUser.id,
          orgId,
          roleId: targetRole.id,
          status: 'ACTIVE',
          createdByUserId: actorUserId,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorId: actorUserId,
        orgId,
        action: 'team.member_created',
        entity: 'membership',
        entityId: newMembership.id,
        meta: {
          name: newUser.name,
          email: newUser.email,
          role: dto.role,
        },
      });

      return {
        id: newMembership.id,
        membershipId: newMembership.id,
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: dto.role,
        status: newMembership.status,
        temporaryPassword: tempPassword,
        createdAt: newMembership.createdAt,
      };
    });

    return result;
  }

  async updateTeamMember(
    orgId: string,
    membershipId: string,
    actorUserId: string,
    actorRole: string,
    dto: UpdateTeamMemberDto,
  ) {
    if (dto.role as string === 'OWNER') {
      throw new ForbiddenException('Cannot assign OWNER role');
    }

    const [target] = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        orgId: memberships.orgId,
        roleId: memberships.roleId,
        roleName: roles.name,
        userName: users.name,
        userEmail: users.email,
        status: memberships.status,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
      .limit(1);

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (target.roleName === 'OWNER') {
      throw new ForbiddenException('Cannot manage an OWNER');
    }

    if (target.userId === actorUserId) {
      throw new ForbiddenException('Cannot manage your own account');
    }

    if (!canManage(actorRole, target.roleName)) {
      throw new ForbiddenException('Cannot manage members with equal or higher rank');
    }

    // Role changes are OWNER-only
    if (dto.role && dto.role !== target.roleName) {
      if (actorRole !== 'OWNER') {
        throw new ForbiddenException('Only owners can change roles');
      }

      const [newRole] = await this.db
        .select()
        .from(roles)
        .where(eq(roles.name, dto.role))
        .limit(1);

      if (!newRole) {
        throw new BadRequestException(`Role ${dto.role} not found`);
      }

      await this.db
        .update(memberships)
        .set({ roleId: newRole.id })
        .where(eq(memberships.id, membershipId));

      await this.auditService.log({
        actorId: actorUserId,
        orgId,
        action: 'team.role_changed',
        entity: 'membership',
        entityId: membershipId,
        meta: { oldRole: target.roleName, newRole: dto.role },
      });
    }

    if (dto.name && dto.name.trim() !== target.userName) {
      await this.db
        .update(users)
        .set({ name: dto.name.trim() })
        .where(eq(users.id, target.userId));

      await this.auditService.log({
        actorId: actorUserId,
        orgId,
        action: 'team.member_updated',
        entity: 'membership',
        entityId: membershipId,
        meta: { name: dto.name.trim() },
      });
    }

    // Fetch updated details
    const [updated] = await this.db
      .select({
        id: memberships.id,
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: roles.name,
        status: memberships.status,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.id, membershipId))
      .limit(1);

    return updated;
  }

  async disableTeamMember(
    orgId: string,
    membershipId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const [target] = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
      .limit(1);

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (target.roleName === 'OWNER') {
      throw new ForbiddenException('Cannot disable an OWNER');
    }

    if (target.userId === actorUserId) {
      throw new ForbiddenException('Cannot disable yourself');
    }

    if (!canManage(actorRole, target.roleName)) {
      throw new ForbiddenException('Cannot manage members with equal or higher rank');
    }

    await this.db
      .update(memberships)
      .set({ status: 'DISABLED' })
      .where(eq(memberships.id, membershipId));

    // Revoke refresh tokens immediately
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, target.userId), isNull(refreshTokens.revokedAt)));

    await this.auditService.log({
      actorId: actorUserId,
      orgId,
      action: 'team.member_disabled',
      entity: 'membership',
      entityId: membershipId,
    });

    return { message: 'Team member disabled' };
  }

  async enableTeamMember(
    orgId: string,
    membershipId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const [target] = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
      .limit(1);

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (target.roleName === 'OWNER') {
      throw new ForbiddenException('Cannot act on an OWNER');
    }

    if (target.userId === actorUserId) {
      throw new ForbiddenException('Cannot act on yourself');
    }

    if (!canManage(actorRole, target.roleName)) {
      throw new ForbiddenException('Cannot manage members with equal or higher rank');
    }

    await this.db
      .update(memberships)
      .set({ status: 'ACTIVE' })
      .where(eq(memberships.id, membershipId));

    await this.auditService.log({
      actorId: actorUserId,
      orgId,
      action: 'team.member_enabled',
      entity: 'membership',
      entityId: membershipId,
    });

    return { message: 'Team member enabled' };
  }

  async resetPassword(
    orgId: string,
    membershipId: string,
    actorUserId: string,
    actorRole: string,
  ) {
    const [target] = await this.db
      .select({
        membershipId: memberships.id,
        userId: memberships.userId,
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
      .limit(1);

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (target.roleName === 'OWNER') {
      throw new ForbiddenException('Cannot reset password of an OWNER');
    }

    if (target.userId === actorUserId) {
      throw new ForbiddenException('Cannot reset your own password this way');
    }

    if (!canManage(actorRole, target.roleName)) {
      throw new ForbiddenException('Cannot manage members with equal or higher rank');
    }

    const tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, target.userId));

    // Revoke refresh tokens immediately
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, target.userId), isNull(refreshTokens.revokedAt)));

    await this.auditService.log({
      actorId: actorUserId,
      orgId,
      action: 'team.password_reset',
      entity: 'membership',
      entityId: membershipId,
    });

    return { temporaryPassword: tempPassword };
  }

  async getActivity(orgId: string, query: ActivityQueryDto) {
    const conditions = [eq(auditLogs.orgId, orgId)];

    if (query.actorId) {
      conditions.push(eq(auditLogs.actorId, query.actorId));
    }
    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.from) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.to)));
    }

    const page = Math.max(1, query.page || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const [totalRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...conditions));

    const total = totalRes?.count || 0;

    const items = await this.db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorName: users.name,
        actorEmail: users.email,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        meta: auditLogs.meta,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
