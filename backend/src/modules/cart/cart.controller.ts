import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { UpsertCartItemDto } from './dto/cart.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Organization } from '../orgs/orgs.types';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentOrg() org: Organization): Promise<unknown> {
    return this.cartService.getCart(org.id);
  }

  @Post('items')
  async upsertItem(
    @CurrentOrg() org: Organization,
    @Body() dto: UpsertCartItemDto,
  ): Promise<unknown> {
    return this.cartService.upsertItem(org.id, dto.variantId, dto.qty);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('items/:variantId')
  async removeItem(
    @CurrentOrg() org: Organization,
    @Param('variantId') variantId: string,
  ): Promise<void> {
    return this.cartService.removeItem(org.id, variantId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  async clearCart(@CurrentOrg() org: Organization): Promise<void> {
    return this.cartService.clearCart(org.id);
  }
}
