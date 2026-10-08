import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import { memberships, organizations, roles } from '../../db/schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../decorators/current-user.decorator';
import type { Organization } from '../../modules/orgs/orgs.types';

interface RequestWithContext {
  headers: Record<string, string>;
  user: JwtPayload;
  activeOrg: Organization;
  userPermissions: string[];
}

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const orgId = request.headers['x-org-id'];
    const user = request.user;

    if (!user) return true; // JwtAuthGuard already handled this

    if (!orgId) {
      // Check if user has a PLATFORM org membership to populate permissions for platform staff
      const platformMembership = await this.db
        .select({
          orgId: memberships.orgId,
          roleId: memberships.roleId,
          permissions: roles.permissions,
          orgName: organizations.name,
          orgStatus: organizations.status,
          orgType: organizations.type,
          canSell: organizations.canSell,
          canBuy: organizations.canBuy,
        })
        .from(memberships)
        .innerJoin(roles, eq(memberships.roleId, roles.id))
        .innerJoin(organizations, eq(memberships.orgId, organizations.id))
        .where(
          and(
            eq(memberships.userId, user.sub),
            eq(organizations.type, 'PLATFORM'),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (platformMembership) {
        request.activeOrg = {
          id: platformMembership.orgId,
          name: platformMembership.orgName,
          status: platformMembership.orgStatus,
          type: platformMembership.orgType,
          canSell: platformMembership.canSell,
          canBuy: platformMembership.canBuy,
        };
        request.userPermissions = platformMembership.permissions ?? [];
      }

      return true;
    }

    // Validate membership
    const membership = await this.db
      .select({
        orgId: memberships.orgId,
        roleId: memberships.roleId,
        permissions: roles.permissions,
        orgName: organizations.name,
        orgStatus: organizations.status,
        orgType: organizations.type,
        canSell: organizations.canSell,
        canBuy: organizations.canBuy,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(organizations, eq(memberships.orgId, organizations.id))
      .where(
        and(eq(memberships.userId, user.sub), eq(memberships.orgId, orgId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    request.activeOrg = {
      id: membership.orgId,
      name: membership.orgName,
      status: membership.orgStatus,
      type: membership.orgType,
      canSell: membership.canSell,
      canBuy: membership.canBuy,
    };
    request.userPermissions = membership.permissions ?? [];

    return true;
  }
}
