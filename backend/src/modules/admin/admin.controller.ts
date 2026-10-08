import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApproveOrgDto, CreateCategoryDto, OrgQueryDto } from './dto/admin.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @RequirePermission('org.view')
  async getDashboard(): Promise<unknown> {
    return this.adminService.getDashboardStats();
  }

  @Get('orgs')
  @RequirePermission('org.view')
  async listOrgs(@Query() query: OrgQueryDto): Promise<unknown[]> {
    return this.adminService.listOrgs(query.status);
  }

  @Put('orgs/:id/status')
  @RequirePermission('org.approve')
  async updateOrgStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveOrgDto,
  ): Promise<unknown> {
    return this.adminService.updateOrgStatus(id, dto.status, user.sub);
  }

  @Get('categories')
  @RequirePermission('category.edit')
  async listCategories(): Promise<unknown[]> {
    return this.adminService.listCategories();
  }

  @Post('categories')
  @RequirePermission('category.edit')
  async createCategory(@Body() dto: CreateCategoryDto): Promise<unknown> {
    return this.adminService.createCategory(dto.name, dto.parentId);
  }

  @Put('categories/:id')
  @RequirePermission('category.edit')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<unknown> {
    return this.adminService.updateCategory(id, dto.name, dto.parentId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('categories/:id')
  @RequirePermission('category.edit')
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.adminService.deleteCategory(id);
  }

  @Get('orders')
  @RequirePermission('order.view.all')
  async listAllOrders(@Query('status') status?: string): Promise<unknown[]> {
    return this.adminService.listAllOrders(status);
  }
}
