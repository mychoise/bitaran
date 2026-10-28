import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { Response } from 'supertest';
import type { UserRole } from '../../src/common/decorators/roles.decorator.js';

/**
 * Signs a staff token the way login does, without spending a login attempt
 * against the rate limit. Use real logins only where login is under test.
 */
export function staffToken(
  app: INestApplication,
  user: { id: string; role: UserRole; businessId: string },
): Promise<string> {
  return app.get(JwtService).signAsync({
    type: 'staff',
    sub: user.id,
    role: user.role,
    businessId: user.businessId,
  });
}

/** Signs a shop token the way shop login does. */
export function shopToken(
  app: INestApplication,
  shop: { id: string },
): Promise<string> {
  return app.get(JwtService).signAsync({ type: 'shop', sub: shop.id });
}

/** Drops all rate-limit counters. The in-memory store's shutdown hook is its only public reset. */
export function resetThrottle(app: INestApplication): void {
  app.get<ThrottlerStorageService>(ThrottlerStorage).onApplicationShutdown();
}

/** No response may carry a password hash, under any name. */
export function expectNoSecrets(res: Response): void {
  expect(res.text).not.toMatch(/password_?hash/i);
  expect(res.text).not.toContain('$argon2');
}
