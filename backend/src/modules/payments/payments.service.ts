import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  payments,
  paymentEvents,
  orders,
  orderItems,
  orderStatusHistory,
  inventoryItems,
  stockMovements,
} from '../../db/schema';
import { MockProvider } from './providers/mock.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly mockProvider: MockProvider,
  ) {}

  async getPayment(paymentId: string): Promise<unknown> {
    const payment = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1)
      .then((r) => r[0]);

    if (!payment) throw new NotFoundException('Payment not found');

    const order = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1)
      .then((r) => r[0]);

    return { ...payment, order };
  }

  /**
   * Mock callback — simulates gateway postback.
   * Do NOT trust action from client; always call verify() server-side.
   */
  async handleMockCallback(
    paymentId: string,
    action: 'pay' | 'fail',
  ): Promise<{ success: boolean; status: string; orderIds: string[] }> {
    return this.db.transaction(async (tx) => {
      const payment = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1)
        .then((r) => r[0]);

      if (!payment) throw new NotFoundException('Payment not found');

      // Idempotency: if already processed, return current state
      if (payment.status !== 'INITIATED') {
        // Log the duplicate callback but do not re-process
        await tx.insert(paymentEvents).values({
          paymentId,
          type: 'CALLBACK',
          raw: { action, duplicate: true, currentStatus: payment.status },
        });
        const affectedOrders = await this.getAffectedOrders(tx, payment.orderId, payment.amountPaisa);
        return { success: payment.status === 'VERIFIED', status: payment.status, orderIds: affectedOrders };
      }

      // Create a mock gatewayRef
      const gatewayRef = action === 'pay'
        ? `MOCK-${payment.id.slice(0, 8).toUpperCase()}-PAID`
        : `MOCK-${payment.id.slice(0, 8).toUpperCase()}-FAILED`;

      // Record callback
      await tx.insert(paymentEvents).values({
        paymentId,
        type: 'CALLBACK',
        raw: { action, gatewayRef },
      });

      // Server-side verify (never trust client action)
      const verification = await this.mockProvider.verify({ gatewayRef });

      await tx.insert(paymentEvents).values({
        paymentId,
        type: 'VERIFY',
        raw: { gatewayRef, ok: verification.ok },
      });

      if (verification.ok) {
        // Mark payment verified
        await tx
          .update(payments)
          .set({ status: 'VERIFIED', gatewayRef })
          .where(eq(payments.id, paymentId));

        // Get the checkout and all related orders
        const primaryOrder = await tx
          .select({ checkoutId: orders.checkoutId })
          .from(orders)
          .where(eq(orders.id, payment.orderId))
          .limit(1)
          .then((r) => r[0]);

        if (!primaryOrder) throw new NotFoundException('Order not found');

        // Find all orders in this checkout
        const allOrders = await tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(eq(orders.checkoutId, primaryOrder.checkoutId));

        const orderIds: string[] = [];
        for (const order of allOrders) {
          if (order.status === 'PAYMENT_PENDING') {
            await tx
              .update(orders)
              .set({ status: 'PAID' })
              .where(eq(orders.id, order.id));

            await tx.insert(orderStatusHistory).values({
              orderId: order.id,
              fromStatus: 'PAYMENT_PENDING',
              toStatus: 'PAID',
              note: `Payment verified via gateway ref: ${gatewayRef}`,
            });
            orderIds.push(order.id);
          }
        }

        return { success: true, status: 'VERIFIED', orderIds };
      } else {
        // Payment failed
        await tx
          .update(payments)
          .set({ status: 'FAILED', gatewayRef })
          .where(eq(payments.id, paymentId));

        // Get related orders and release stock
        const primaryOrder = await tx
          .select({ checkoutId: orders.checkoutId })
          .from(orders)
          .where(eq(orders.id, payment.orderId))
          .limit(1)
          .then((r) => r[0]);

        if (primaryOrder) {
          const allOrders = await tx
            .select({ id: orders.id, status: orders.status })
            .from(orders)
            .where(eq(orders.checkoutId, primaryOrder.checkoutId));

          for (const order of allOrders) {
            if (order.status === 'PAYMENT_PENDING') {
              await tx
                .update(orders)
                .set({ status: 'PAYMENT_FAILED' })
                .where(eq(orders.id, order.id));

              await tx.insert(orderStatusHistory).values({
                orderId: order.id,
                fromStatus: 'PAYMENT_PENDING',
                toStatus: 'PAYMENT_FAILED',
                note: 'Payment failed',
              });

              // Release stock
              const items = await tx
                .select()
                .from(orderItems)
                .where(eq(orderItems.orderId, order.id));

              for (const item of items) {
                await tx
                  .update(inventoryItems)
                  .set({
                    qtyReserved: sql`${inventoryItems.qtyReserved} - ${item.qty}`,
                  })
                  .where(eq(inventoryItems.variantId, item.variantId));

                await tx.insert(stockMovements).values({
                  variantId: item.variantId,
                  delta: item.qty,
                  reason: 'ORDER_RELEASE',
                  refId: order.id,
                });
              }
            }
          }
        }

        return { success: false, status: 'FAILED', orderIds: [] };
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getAffectedOrders(tx: any, primaryOrderId: string, _amountPaisa: bigint): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const primaryOrder = await tx
      .select({ checkoutId: orders.checkoutId })
      .from(orders)
      .where(eq(orders.id, primaryOrderId))
      .limit(1)
      .then((r: Array<{checkoutId: string}>) => r[0]);

    if (!primaryOrder) return [primaryOrderId];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const allOrders = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.checkoutId, primaryOrder.checkoutId));

    return (allOrders as Array<{id: string}>).map(o => o.id);
  }
}
