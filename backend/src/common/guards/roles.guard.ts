import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { TokenPayload } from '../decorators/current-user.decorator.js';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator.js';

/** Enforces @Roles(...). Only staff have roles, so shop tokens never pass. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();
    if (user?.type !== 'staff' || !roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this route');
    }
    return true;
  }
}
