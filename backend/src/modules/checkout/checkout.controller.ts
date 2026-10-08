import { Controller, Post, Body } from '@nestjs/common';
import { CheckoutService, CheckoutResult } from './checkout.service';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Organization } from '../orgs/orgs.types';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  async createCheckout(
    @CurrentOrg() org: Organization,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutResult> {
    return this.checkoutService.createCheckout(org.id, dto);
  }
}
