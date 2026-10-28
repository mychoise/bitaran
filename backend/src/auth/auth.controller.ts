import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { TokenPayload } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { LoginThrottle } from '../common/throttle.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @LoginThrottle()
  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  staffLogin(@Body() body: LoginDto) {
    return this.auth.staffLogin(body.email, body.password);
  }

  @Public()
  @LoginThrottle()
  @Post('shop/login')
  @HttpCode(HttpStatus.OK)
  shopLogin(@Body() body: LoginDto) {
    return this.auth.shopLogin(body.email, body.password);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: TokenPayload) {
    return this.auth.getProfile(user);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: TokenPayload,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(
      user,
      body.currentPassword,
      body.newPassword,
    );
  }
}
