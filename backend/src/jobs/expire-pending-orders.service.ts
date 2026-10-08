import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from '../modules/orders/orders.service';

@Injectable()
export class ExpirePendingOrdersService {
  private readonly logger = new Logger(ExpirePendingOrdersService.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiry(): Promise<void> {
    try {
      const count = await this.ordersService.expireStuckOrders();
      if (count > 0) {
        this.logger.log(`Expired ${String(count)} pending orders`);
      }
    } catch (err) {
      this.logger.error('Error expiring pending orders', err);
    }
  }
}
