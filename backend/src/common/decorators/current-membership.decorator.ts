import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ActiveMembership {
  id: string;
  roleName: string;
  status: string;
}

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveMembership | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ activeMembership?: ActiveMembership }>();
    return request.activeMembership;
  },
);
