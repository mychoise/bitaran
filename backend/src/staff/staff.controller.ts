import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  ResetPasswordDto,
  UpdateStaffDto,
} from './dto/staff.dto.js';
import { StaffService } from './staff.service.js';

// Finer rules (who may manage whom) live in StaffService.
@ApiTags('staff')
@ApiBearerAuth()
@StaffOnly()
@Roles('owner', 'manager')
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListStaffQueryDto,
  ) {
    return this.staff.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: StaffTokenPayload, @Body() body: CreateStaffDto) {
    return this.staff.create(user, body);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.staff.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staff.update(user, id, body);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordDto,
  ): Promise<void> {
    await this.staff.resetPassword(user, id, body.temporaryPassword);
  }
}
