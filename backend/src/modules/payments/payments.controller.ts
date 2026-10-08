import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  async getPayment(@Param('id') id: string): Promise<unknown> {
    return this.paymentsService.getPayment(id);
  }

  @Public()
  @Post(':id/mock-callback')
  @HttpCode(HttpStatus.OK)
  async mockCallback(
    @Param('id') id: string,
    @Body() body: { action: 'pay' | 'fail' },
  ): Promise<{ success: boolean; status: string; orderIds: string[] }> {
    return this.paymentsService.handleMockCallback(id, body.action);
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async callback(
    @Body() body: { paymentId: string; action: 'pay' | 'fail' },
  ): Promise<{ success: boolean; status: string; orderIds: string[] }> {
    return this.paymentsService.handleMockCallback(body.paymentId, body.action);
  }
}
