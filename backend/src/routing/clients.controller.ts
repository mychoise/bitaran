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
import type {
  ShopTokenPayload,
  StaffTokenPayload,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ShopOnly,
  StaffOnly,
} from '../common/decorators/user-type.decorator.js';
import { ClientsService } from './clients.service.js';
import {
  CreateClientDto,
  ListClientsQueryDto,
  ResetClientPasswordDto,
  UpdateClientDto,
} from './dto/client.dto.js';

// Staff-only: a shop token never reaches these, so no shop can read another.
// Salesmen may create and edit shops; ClientsService limits what they set.
@ApiTags('clients')
@ApiBearerAuth()
@StaffOnly()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clients.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clients.get(user.businessId, id);
  }

  @Post()
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateClientDto,
  ) {
    return this.clients.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientDto,
  ) {
    return this.clients.update(user, id, body);
  }

  @Roles('owner', 'manager')
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetClientPasswordDto,
  ): Promise<void> {
    await this.clients.resetPassword(
      user.businessId,
      id,
      body.temporaryPassword,
    );
  }
}

/** The logged-in shop's own record. Takes no id: it can only be its own. */
@ApiTags('shop')
@ApiBearerAuth()
@ShopOnly()
@Controller('shop')
export class ShopController {
  constructor(private readonly clients: ClientsService) {}

  @Get('me')
  me(@CurrentUser() shop: ShopTokenPayload) {
    return this.clients.getOwn(shop.sub);
  }
}
