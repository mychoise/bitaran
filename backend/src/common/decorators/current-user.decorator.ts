import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface StaffTokenPayload {
  type: 'staff';
  sub: string; // user id
  role: 'owner' | 'manager' | 'salesman';
  businessId: string;
}

export interface ShopTokenPayload {
  type: 'shop';
  sub: string; // retail_client id
}

export type TokenPayload = StaffTokenPayload | ShopTokenPayload;

/** Extracts the JWT payload from the request. Set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: TokenPayload }>();
    return request.user;
  },
);
