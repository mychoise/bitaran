import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  shipments,
  shipmentEvents,
  orders,
  orderStatusHistory,
  organizations,
  addresses,
  checkouts,
} from '../../db/schema';

type ShipmentStatusType =
  | 'PICKUP_PENDING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

type TargetOrderStatus = (typeof orders.$inferInsert)['status'];

// Maps shipment status to corresponding order status
const SHIPMENT_TO_ORDER_STATUS: Record<ShipmentStatusType, TargetOrderStatus | null> = {
  PICKUP_PENDING: null,
  PICKED_UP: null,
  IN_TRANSIT: 'IN_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: null,
  RETURNED: 'RETURNED',
};

@Injectable()
export class ShipmentsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listShipments(): Promise<unknown[]> {
    return this.db
      .select({
        id: shipments.id,
        orderId: shipments.orderId,
        status: shipments.status,
        courierName: shipments.courierName,
        trackingRef: shipments.trackingRef,
        pickupAddress: shipments.pickupAddress,
        dropAddress: shipments.dropAddress,
        createdAt: shipments.createdAt,
        orderStatus: orders.status,
        sellerOrgId: orders.sellerOrgId,
        buyerOrgId: orders.buyerOrgId,
      })
      .from(shipments)
      .innerJoin(orders, eq(shipments.orderId, orders.id));
  }

  async createShipmentForOrder(
    orderId: string,
    actorId: string,
  ): Promise<unknown> {
    return this.db.transaction(async (tx) => {
      const order = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .then((r) => r[0]);

      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'READY_FOR_PICKUP') {
        throw new BadRequestException(
          'Shipment can only be created for orders in READY_FOR_PICKUP status',
        );
      }

      // Check if shipment already exists
      const existing = await tx
        .select({ id: shipments.id })
        .from(shipments)
        .where(eq(shipments.orderId, orderId))
        .limit(1)
        .then((r) => r[0]);

      if (existing) return existing;

      // Get seller address as pickup
      const sellerDefaultAddress = await tx
        .select()
        .from(addresses)
        .where(
          eq(addresses.orgId, order.sellerOrgId),
        )
        .limit(1)
        .then((r) => r[0]);

      const pickupAddress = sellerDefaultAddress
        ? {
            line1: sellerDefaultAddress.line1,
            city: sellerDefaultAddress.city,
            district: sellerDefaultAddress.district,
            phone: sellerDefaultAddress.phone,
          }
        : { line1: 'Seller address', city: 'Unknown' };

      const checkout = await tx
        .select({ shippingAddress: checkouts.shippingAddress })
        .from(checkouts)
        .where(eq(checkouts.id, order.checkoutId))
        .limit(1)
        .then((r) => r[0]);

      const dropAddress = checkout?.shippingAddress ?? { line1: 'Buyer address', city: 'Unknown' };

      const [shipment] = await tx
        .insert(shipments)
        .values({
          orderId,
          status: 'PICKUP_PENDING',
          pickupAddress,
          dropAddress,
          feePaisa: 0,
        })
        .returning();

      await tx.insert(shipmentEvents).values({
        shipmentId: shipment.id,
        status: 'PICKUP_PENDING',
        actorId,
        note: 'Shipment created',
      });

      return shipment;
    });
  }

  async updateShipment(
    shipmentId: string,
    status: ShipmentStatusType,
    actorId: string,
    courierName?: string,
    trackingRef?: string,
    note?: string,
  ): Promise<unknown> {
    return this.db.transaction(async (tx) => {
      const shipment = await tx
        .select()
        .from(shipments)
        .where(eq(shipments.id, shipmentId))
        .limit(1)
        .then((r) => r[0]);

      if (!shipment) throw new NotFoundException('Shipment not found');

      await tx
        .update(shipments)
        .set({
          status,
          courierName: courierName ?? shipment.courierName,
          trackingRef: trackingRef ?? shipment.trackingRef,
        })
        .where(eq(shipments.id, shipmentId));

      await tx.insert(shipmentEvents).values({
        shipmentId,
        status,
        actorId,
        note,
      });

      // Keep order status in sync
      const nextOrderStatus = SHIPMENT_TO_ORDER_STATUS[status];
      if (nextOrderStatus) {
        const order = await tx
          .select({ status: orders.status })
          .from(orders)
          .where(eq(orders.id, shipment.orderId))
          .limit(1)
          .then((r) => r[0]);

        if (order) {
          await tx
            .update(orders)
            .set({ status: nextOrderStatus })
            .where(eq(orders.id, shipment.orderId));

          await tx.insert(orderStatusHistory).values({
            orderId: shipment.orderId,
            fromStatus: order.status,
            toStatus: nextOrderStatus,
            actorId,
            note: `Shipment status changed to ${status}`,
          });
        }
      }

      return tx
        .select()
        .from(shipments)
        .where(eq(shipments.id, shipmentId))
        .limit(1)
        .then((r) => r[0]);
    });
  }

  async getShipment(shipmentId: string): Promise<unknown> {
    const shipment = await this.db
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipmentId))
      .limit(1)
      .then((r) => r[0]);

    if (!shipment) throw new NotFoundException('Shipment not found');

    const events = await this.db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipmentId));

    return { ...shipment, events };
  }
}
