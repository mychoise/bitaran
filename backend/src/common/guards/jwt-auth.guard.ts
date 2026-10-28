import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
import type { TokenPayload } from '../decorators/current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Global guard: every route needs a valid Bearer token unless marked
 * @Public(). The token's subject is re-checked against the database on each
 * request, so deactivation takes effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenPayload }>();
    const token = bearerToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.type !== 'staff' && payload.type !== 'shop') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const principal = await this.auth.resolvePrincipal(payload);
    if (!principal) {
      throw new UnauthorizedException('Account is no longer active');
    }
    request.user = principal;
    return true;
  }
}

function bearerToken(request: Request): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
