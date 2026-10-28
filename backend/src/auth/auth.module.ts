import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UserTypeGuard } from '../common/guards/user-type.guard.js';
import type { AppConfigService } from '../config/app-config.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export { LOGIN_THROTTLE } from '../common/throttle.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          // JWT_EXPIRY is an ms-style duration such as '1d'.
          expiresIn: config.get('JWT_EXPIRY', {
            infer: true,
          }) as JwtSignOptions['expiresIn'],
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Global guards run in this order: authenticate, then user type, then role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserTypeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
