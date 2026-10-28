import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { BusinessService } from './business.service.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

@ApiTags('business')
@ApiBearerAuth()
@StaffOnly()
@Controller('business')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get()
  get(@CurrentUser() user: StaffTokenPayload) {
    return this.business.get(user.businessId);
  }

  @Roles('owner')
  @Patch()
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: UpdateBusinessDto,
  ) {
    return this.business.update(user.businessId, body);
  }
}
