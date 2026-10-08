import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  orders,
  orderItems,
  orderStatusHistory,
  inventoryItems,
  stockMovements,
  shipments,
} from '../../db/schema';

type OrderStatusType =
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAID'
  | 'CONFIRMED'
  | 'REJECTED_REFUND_PENDING'
  | 'REFUNDED'
  | 'READY_FOR_PICKUP'
  | 'IN_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

// State machine transitions
const ALLOWED_TRANSITIONS: Record<string, OrderStatusType[]> = {
  PAYMENT_PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['CONFIRMED', 'REJECTED_REFUND_PENDING'],
  REJECTED_REFUND_PENDING: ['REFUNDED'],
  CONFIRMED: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['IN_DELIVERY'],
  IN_DELIVERY: ['DELIVERED'],
};

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listBuyerOrders(
    buyerOrgId: string,
    status?: string,
  ): Promise<unknown[]> {
    const query = this.db
      .select({
        id: orders.id,
        sellerOrgId: orders.sellerOrgId,
        status: orders.status,
        totalPaisa: orders.totalPaisa,
        createdAt: orders.createdAt,
        checkoutId: orders.checkoutId,
      })
      .from(orders)
      .where(eq(orders.buyerOrgId, buyerOrgId));

    return query;
  }

  async listSellerOrders(
    sellerOrgId: string,
    status?: string,
  ): Promise<unknown[]> {
    const conditions = [eq(orders.sellerOrgId, sellerOrgId)];
    return this.db
      .select({
        id: orders.id,
        buyerOrgId: orders.buyerOrgId,
        status: orders.status,
        totalPaisa: orders.totalPaisa,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(...conditions));
  }

  async getOrder(
    orderId: string,
    orgId: string,
    isAdmin = false,
  ): Promise<unknown> {
    const order = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)
      .then((r) => r[0]);

    if (!order) throw new NotFoundException('Order not found');

    if (
      !isAdmin &&
      order.buyerOrgId !== orgId &&
      order.sellerOrgId !== orgId
    ) {
      throw new ForbiddenException('Access denied to this order');
    }

    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const history = await this.db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId));

    const shipment = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .limit(1)
      .then((r) => r[0] ?? null);

    return { ...order, items, history, shipment };
  }

  async transitionOrder(
    orderId: string,
    toStatus: OrderStatusType,
    actorId: string,
    orgId: string,
    isAdmin = false,
    note?: string,
  ): Promise<unknown> {
    return this.db.transaction(async (tx) => {
      const order = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .then((r) => r[0]);

      if (!order) throw new NotFoundException('Order not found');

      if (
        !isAdmin &&
        order.buyerOrgId !== orgId &&
        order.sellerOrgId !== orgId
      ) {
        throw new ForbiddenException('Access denied');
      }

      const fromStatus = order.status as OrderStatusType;
      const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];

      if (!allowed.includes(toStatus)) {
        throw new ConflictException(
          `Cannot transition from ${fromStatus} to ${toStatus}`,
        );
      }

      // Stock effects
      if (
        toStatus === 'PAYMENT_FAILED' ||
        toStatus === 'CANCELLED' ||
        toStatus === 'REFUNDED'
      ) {
        // Release reservation
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

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
            refId: orderId,
          });
        }
      } else if (toStatus === 'IN_DELIVERY') {
        // Reduce qtyOnHand and qtyReserved
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

        for (const item of items) {
          await tx
            .update(inventoryItems)
            .set({
              qtyOnHand: sql`${inventoryItems.qtyOnHand} - ${item.qty}`,
              qtyReserved: sql`${inventoryItems.qtyReserved} - ${item.qty}`,
            })
            .where(eq(inventoryItems.variantId, item.variantId));

          await tx.insert(stockMovements).values({
            variantId: item.variantId,
            delta: -item.qty,
            reason: 'ORDER_SHIPPED',
            refId: orderId,
          });
        }
      }

      const [updated] = await tx
        .update(orders)
        .set({ status: toStatus })
        .where(eq(orders.id, orderId))
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus,
        toStatus,
        actorId,
        note,
      });

      return updated;
    });
  }

  async listAllOrders(status?: string): Promise<unknown[]> {
    return this.db
      .select({
        id: orders.id,
        buyerOrgId: orders.buyerOrgId,
        sellerOrgId: orders.sellerOrgId,
        status: orders.status,
        totalPaisa: orders.totalPaisa,
        createdAt: orders.createdAt,
      })
      .from(orders);
  }

  // Called by the expiry job
  async expireStuckOrders(): Promise<number> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const stuckOrders = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'PAYMENT_PENDING'),
          sql`${orders.createdAt} < ${fifteenMinutesAgo.toISOString()}`,
        ),
      );

    for (const order of stuckOrders) {
      try {
        await this.transitionOrder(
          order.id,
          'CANCELLED',
          'system',
          '',
          true,
          'Auto-cancelled: payment not received within 15 minutes',
        );
      } catch {
        // Already transitioned or error — skip
      }
    }

    return stuckOrders.length;
  }
}
