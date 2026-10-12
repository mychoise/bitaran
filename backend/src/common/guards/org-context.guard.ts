import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import { memberships, organizations, roles, fieldSellers } from '../../db/schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../decorators/current-user.decorator';
import type { Organization } from '../../modules/orgs/orgs.types';

interface RequestWithContext {
  headers: Record<string, string>;
  user: JwtPayload;
  activeOrg: Organization;
  userPermissions: string[];
  activeMembership?: {
    id: string;
    roleName: string;
    status: string;
  };
  url?: string;
  originalUrl?: string;
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

    // Fetch user memberships with roles and organizations
    const userMemberships = await this.db
      .select({
        membershipId: memberships.id,
        membershipStatus: memberships.status,
        orgId: memberships.orgId,
        roleId: memberships.roleId,
        roleName: roles.name,
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
      .where(eq(memberships.userId, user.sub));

    // Handle FIELD_SELLER role
    const fieldSellerMem = userMemberships.find((m) => m.roleName === 'FIELD_SELLER');
    if (fieldSellerMem) {
      if (fieldSellerMem.membershipStatus === 'DISABLED') {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Membership is disabled',
          code: 'MEMBERSHIP_DISABLED',
        });
      }

      // Check field_sellers status
      const [fieldSeller] = await this.db
        .select({ status: fieldSellers.status })
        .from(fieldSellers)
        .where(eq(fieldSellers.userId, user.sub))
        .limit(1);

      if (fieldSeller && fieldSeller.status === 'DISABLED') {
        throw new ForbiddenException('Field seller account is disabled');
      }

      // Restrict access to buyer, seller, admin routes
      const rawUrl = request.originalUrl || request.url || '';
      const cleanPath = rawUrl.replace(/^\/api\/v1/, '').split('?')[0];
      if (
        cleanPath.startsWith('/seller') ||
        cleanPath.startsWith('/admin') ||
        cleanPath.startsWith('/cart') ||
        cleanPath.startsWith('/checkout') ||
        cleanPath.startsWith('/orders')
      ) {
        throw new ForbiddenException('Field sellers cannot access buyer, seller, or admin routes');
      }

      request.activeOrg = {
        id: fieldSellerMem.orgId,
        name: fieldSellerMem.orgName,
        status: fieldSellerMem.orgStatus,
        type: fieldSellerMem.orgType,
        canSell: fieldSellerMem.canSell,
        canBuy: fieldSellerMem.canBuy,
      };
      request.userPermissions = fieldSellerMem.permissions ?? [];
      request.activeMembership = {
        id: fieldSellerMem.membershipId,
        roleName: fieldSellerMem.roleName,
        status: fieldSellerMem.membershipStatus,
      };
      return true;
    }

    if (!orgId) {
      // Check if user has a PLATFORM org membership to populate permissions for platform staff
      const platformMembership = userMemberships.find(
        (m) => m.orgType === 'PLATFORM',
      );

      if (platformMembership) {
        if (platformMembership.membershipStatus === 'DISABLED') {
          throw new ForbiddenException({
            statusCode: 403,
            message: 'Membership is disabled',
            code: 'MEMBERSHIP_DISABLED',
          });
        }
        request.activeOrg = {
          id: platformMembership.orgId,
          name: platformMembership.orgName,
          status: platformMembership.orgStatus,
          type: platformMembership.orgType,
          canSell: platformMembership.canSell,
          canBuy: platformMembership.canBuy,
        };
        request.userPermissions = platformMembership.permissions ?? [];
        request.activeMembership = {
          id: platformMembership.membershipId,
          roleName: platformMembership.roleName,
          status: platformMembership.membershipStatus,
        };
      } else if (userMemberships.length === 1) {
        const singleMem = userMemberships[0];
        if (singleMem.membershipStatus === 'DISABLED') {
          throw new ForbiddenException({
            statusCode: 403,
            message: 'Membership is disabled',
            code: 'MEMBERSHIP_DISABLED',
          });
        }
        request.activeOrg = {
          id: singleMem.orgId,
          name: singleMem.orgName,
          status: singleMem.orgStatus,
          type: singleMem.orgType,
          canSell: singleMem.canSell,
          canBuy: singleMem.canBuy,
        };
        request.userPermissions = singleMem.permissions ?? [];
        request.activeMembership = {
          id: singleMem.membershipId,
          roleName: singleMem.roleName,
          status: singleMem.membershipStatus,
        };
      }

      return true;
    }

    // Validate membership
    const membership = userMemberships.find((m) => m.orgId === orgId);

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    if (membership.membershipStatus === 'DISABLED') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Membership is disabled',
        code: 'MEMBERSHIP_DISABLED',
      });
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
    request.activeMembership = {
      id: membership.membershipId,
      roleName: membership.roleName,
      status: membership.membershipStatus,
    };

    return true;
  }
}
