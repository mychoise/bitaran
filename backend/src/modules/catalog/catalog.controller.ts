import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  CreateVariantDto,
} from './dto/catalog.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Organization } from '../orgs/orgs.types';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ---- Public metadata ----

  @Public()
  @Get('categories')
  async listCategories(): Promise<unknown[]> {
    return this.catalogService.listCategories();
  }

  @Public()
  @Get('sellers')
  async listSellers(): Promise<unknown[]> {
    return this.catalogService.listSellers();
  }

  // ---- Seller management (Static paths must be registered before parameterized :id) ----

  @Get(['products/seller', 'seller/products'])
  @RequirePermission('product.view')
  async listMyProducts(@CurrentOrg() org: Organization): Promise<unknown[]> {
    return this.catalogService.listMyProducts(org.id);
  }

  @Post(['products', 'seller/products'])
  @RequirePermission('product.edit')
  async createProduct(
    @CurrentOrg() org: Organization,
    @Body() dto: CreateProductDto,
  ): Promise<unknown> {
    return this.catalogService.createProduct(org.id, dto);
  }

  @Put(['products/:id', 'seller/products/:id'])
  @RequirePermission('product.edit')
  async updateProduct(
    @Param('id') id: string,
    @CurrentOrg() org: Organization,
    @Body() dto: UpdateProductDto,
  ): Promise<unknown> {
    return this.catalogService.updateProduct(id, org.id, dto);
  }

  @Post(['products/:id/variants', 'seller/products/:id/variants'])
  @RequirePermission('product.edit')
  async addVariant(
    @Param('id') id: string,
    @CurrentOrg() org: Organization,
    @Body() dto: CreateVariantDto,
  ): Promise<unknown> {
    return this.catalogService.addVariant(id, org.id, dto);
  }

  // ---- Public browse & product detail ----

  @Public()
  @Get(['products', 'browse'])
  async browse(@Query() query: ProductQueryDto): Promise<unknown[]> {
    return this.catalogService.browse(query);
  }

  @Public()
  @Get(['products/:id', 'seller/products/:id'])
  async getPublicProduct(@Param('id') id: string): Promise<unknown> {
    return this.catalogService.getPublicProduct(id);
  }
}
