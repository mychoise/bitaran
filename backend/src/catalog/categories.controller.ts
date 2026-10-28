import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';

@ApiTags('catalog')
@ApiBearerAuth()
@StaffOnly()
@Controller('product-categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // Any staff: salesmen need categories to filter the product list.
  @Get()
  list(@CurrentUser() user: StaffTokenPayload) {
    return this.categories.list(user.businessId);
  }

  @Roles('owner', 'manager')
  @Post()
  create(@CurrentUser() user: StaffTokenPayload, @Body() body: CategoryDto) {
    return this.categories.create(user.businessId, body.name);
  }

  @Roles('owner', 'manager')
  @Patch(':id')
  rename(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CategoryDto,
  ) {
    return this.categories.rename(user.businessId, id, body.name);
  }

  @Roles('owner', 'manager')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.categories.delete(user.businessId, id);
  }
}
