import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { TokenPayload } from '../decorators/current-user.decorator.js';
import { USER_TYPE_KEY } from '../decorators/user-type.decorator.js';

/** Enforces @StaffOnly() / @ShopOnly(). Runs after JwtAuthGuard. */
@Injectable()
export class UserTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      TokenPayload['type'] | undefined
    >(USER_TYPE_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();
    if (user?.type !== required) {
      throw new ForbiddenException(`This route is for ${required} accounts`);
    }
    return true;
  }
}
