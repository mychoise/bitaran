import { SetMetadata } from '@nestjs/common';

export const USER_TYPE_KEY = 'userType';

/** Require the JWT token to be of type 'staff'. Shop tokens are rejected. */
export const StaffOnly = () => SetMetadata(USER_TYPE_KEY, 'staff');

/** Require the JWT token to be of type 'shop'. Staff tokens are rejected. */
export const ShopOnly = () => SetMetadata(USER_TYPE_KEY, 'shop');
