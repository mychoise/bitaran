import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import {
  CreateReturnDto,
  CreateWriteOffDto,
  ListReturnsQueryDto,
  ListWriteOffsQueryDto,
} from './dto/returns.dto.js';
import { ReturnsService } from './returns.service.js';
import { WriteOffsService } from './write-offs.service.js';

// All staff. Salesmen record on their own running day and see only what
// they recorded; the services enforce that.
@ApiTags('returns')
@ApiBearerAuth()
@StaffOnly()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateReturnDto,
  ) {
    return this.returns.create(user, body);
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListReturnsQueryDto,
  ) {
    return this.returns.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returns.get(user, id);
  }
}

@ApiTags('returns')
@ApiBearerAuth()
@StaffOnly()
@Controller('clients')
export class ClientReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get(':id/returns')
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListReturnsQueryDto,
  ) {
    return this.returns.forClient(user, id, query);
  }
}

@ApiTags('returns')
@ApiBearerAuth()
@StaffOnly()
@Controller('write-offs')
export class WriteOffsController {
  constructor(private readonly writeOffs: WriteOffsService) {}

  @Post()
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateWriteOffDto,
  ) {
    return this.writeOffs.create(user, body);
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListWriteOffsQueryDto,
  ) {
    return this.writeOffs.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.writeOffs.get(user, id);
  }
}
