import { applyDecorators, Injectable, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';

// Throttling applies only where these decorators are used, never globally.
// Every guarded route is checked against every named limit unless it skips
// it, so each decorator skips the others.

/** Login attempts: per client IP and login route. */
export const LOGIN_THROTTLE = { name: 'login', ttl: 60_000, limit: 5 };
/** Upload requests: per staff member and upload route. */
export const UPLOAD_THROTTLE = { name: 'upload', ttl: 60_000, limit: 20 };
export const THROTTLES = [LOGIN_THROTTLE, UPLOAD_THROTTLE];

/**
 * Counts per authenticated user, so salesmen sharing a mobile network (one
 * public IP) do not use up each other's budget. Runs after the global
 * JwtAuthGuard, which sets request.user.
 */
@Injectable()
class PerUserThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: {
    user?: { sub: string };
    ip?: string;
  }): Promise<string> {
    return Promise.resolve(req.user?.sub ?? req.ip ?? 'unknown');
  }
}

export const LoginThrottle = () =>
  applyDecorators(
    UseGuards(ThrottlerGuard),
    SkipThrottle({ [UPLOAD_THROTTLE.name]: true }),
  );

export const UploadThrottle = () =>
  applyDecorators(
    UseGuards(PerUserThrottlerGuard),
    SkipThrottle({ [LOGIN_THROTTLE.name]: true }),
  );
