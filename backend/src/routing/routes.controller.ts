import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import {
  CreateRouteDto,
  ListRoutesQueryDto,
  SetRouteClientsDto,
  UpdateRouteDto,
} from './dto/route.dto.js';
import { RoutesService } from './routes.service.js';

// Reads are open to all staff (salesmen work routes); changes are not.
@ApiTags('routes')
@ApiBearerAuth()
@StaffOnly()
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListRoutesQueryDto,
  ) {
    return this.routes.list(user.businessId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.routes.get(user.businessId, id);
  }

  @Roles('owner', 'manager')
  @Post()
  create(@CurrentUser() user: StaffTokenPayload, @Body() body: CreateRouteDto) {
    return this.routes.create(user, body);
  }

  /** Update or deactivate (isActive: false). Routes are never deleted. */
  @Roles('owner', 'manager')
  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRouteDto,
  ) {
    return this.routes.update(user.businessId, id, body);
  }

  @Roles('owner', 'manager')
  @Put(':id/clients')
  setClients(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetRouteClientsDto,
  ) {
    return this.routes.setClients(user.businessId, id, body.clientIds);
  }
}
