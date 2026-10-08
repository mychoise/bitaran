import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Organization } from '../../modules/orgs/orgs.types';

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Organization => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ activeOrg: Organization }>();
    return request.activeOrg;
  },
);
