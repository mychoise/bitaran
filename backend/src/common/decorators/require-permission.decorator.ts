import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (
  permission: string,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
