import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  carts,
  cartItems,
  productVariants,
  products,
  inventoryItems,
  stockMovements,
  addresses,
  checkouts,
  orders,
  orderItems,
  orderStatusHistory,
  payments,
  paymentEvents,
  organizations,
} from '../../db/schema';
import { CreateCheckoutDto } from './dto/checkout.dto';
import { InsufficientStockException } from '../../common/errors/domain.exceptions';

export interface CheckoutResult {
  checkoutId: string;
  totalPaisa: string;
  orders: Array<{ orderId: string; sellerOrgId: string; totalPaisa: string; status: string }>;
  payments: Array<{ id: string; orderId: string; amountPaisa: string }>;
  paymentId: string;
  mockPaymentUrl: string;
}

@Injectable()
export class CheckoutService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createCheckout(
    buyerOrgId: string,
    dto: CreateCheckoutDto,
  ): Promise<CheckoutResult> {
    const buyerOrg = await this.db
      .select({ id: organizations.id, status: organizations.status, canBuy: organizations.canBuy })
      .from(organizations)
      .where(eq(organizations.id, buyerOrgId))
      .limit(1)
      .then((r) => r[0]);

    if (!buyerOrg || buyerOrg.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Your business account is pending approval. You cannot place orders until verified by an administrator.',
      );
    }
    if (!buyerOrg.canBuy) {
      throw new ForbiddenException(
        'Your organization does not have buyer permissions enabled.',
      );
    }

    // 1. Get cart items
    const cart = await this.db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.buyerOrgId, buyerOrgId))
      .limit(1)
      .then((r) => r[0]);

    if (!cart) throw new BadRequestException('Cart is empty');

    const cartItemsList = await this.db
      .select({
        variantId: cartItems.variantId,
        qty: cartItems.qty,
        pricePaisa: productVariants.pricePaisa,
        minOrderQty: productVariants.minOrderQty,
        sku: productVariants.sku,
        unit: productVariants.unit,
        productName: products.name,
        sellerOrgId: products.sellerOrgId,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(cartItems.cartId, cart.id));

    if (cartItemsList.length === 0) throw new BadRequestException('Cart is empty');

    // 2. Validate no self-purchase
    const ownSeller = cartItemsList.find((i) => i.sellerOrgId === buyerOrgId);
    if (ownSeller) {
      throw new BadRequestException('Cannot purchase from your own organization');
    }

    // 3. Validate address belongs to buyer
    const address = await this.db
      .select()
      .from(addresses)
      .where(
        and(eq(addresses.id, dto.addressId), eq(addresses.orgId, buyerOrgId)),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!address) throw new NotFoundException('Address not found');

    // 4. Validate seller orgs are approved
    const sellerOrgIds = [...new Set(cartItemsList.map((i) => i.sellerOrgId))];
    const sellerOrgs = await this.db
      .select({ id: organizations.id, status: organizations.status })
      .from(organizations)
      .where(inArray(organizations.id, sellerOrgIds));

    const unapproved = sellerOrgs.find((o) => o.status !== 'APPROVED');
    if (unapproved) {
      throw new BadRequestException(
        `Seller organization is not approved for selling`,
      );
    }

    // 5. Create checkout + orders + reserve stock atomically
    return this.db.transaction(async (tx) => {
      // Reserve stock atomically (no read-then-write)
      for (const item of cartItemsList) {
        const n = item.qty;
        const [reserved] = await tx
          .update(inventoryItems)
          .set({
            qtyReserved: sql`${inventoryItems.qtyReserved} + ${n}`,
          })
          .where(
            and(
              eq(inventoryItems.variantId, item.variantId),
              sql`${inventoryItems.qtyOnHand} - ${inventoryItems.qtyReserved} >= ${n}`,
            ),
          )
          .returning({ id: inventoryItems.id });

        if (!reserved) {
          throw new InsufficientStockException(item.variantId);
        }

        await tx.insert(stockMovements).values({
          variantId: item.variantId,
          delta: -n,
          reason: 'ORDER_RESERVE',
        });
      }

      // Calculate totals
      const totalPaisa = cartItemsList.reduce(
        (sum, i) => sum + BigInt(i.pricePaisa) * BigInt(i.qty),
        0n,
      );

      // Create checkout record
      const [checkout] = await tx
        .insert(checkouts)
        .values({
          buyerOrgId,
          shippingAddress: {
            id: address.id,
            line1: address.line1,
            city: address.city,
            district: address.district,
            province: address.province,
            phone: address.phone,
            label: address.label,
          },
          totalPaisa,
          paymentProvider: dto.paymentProvider,
        })
        .returning({ id: checkouts.id });

      // Create one order per seller
      const sellerGroups = new Map<
        string,
        typeof cartItemsList
      >();
      for (const item of cartItemsList) {
        if (!sellerGroups.has(item.sellerOrgId)) {
          sellerGroups.set(item.sellerOrgId, []);
        }
        sellerGroups.get(item.sellerOrgId)!.push(item);
      }

      const createdOrders: Array<{
        orderId: string;
        sellerOrgId: string;
        totalPaisa: string;
        status: string;
      }> = [];

      for (const [sellerOrgId, items] of sellerGroups) {
        const subtotal = items.reduce(
          (sum, i) => sum + BigInt(i.pricePaisa) * BigInt(i.qty),
          0n,
        );

        const [order] = await tx
          .insert(orders)
          .values({
            checkoutId: checkout.id,
            buyerOrgId,
            sellerOrgId,
            subtotalPaisa: subtotal,
            deliveryFee: 0,
            totalPaisa: subtotal,
            status: 'PAYMENT_PENDING',
          })
          .returning({ id: orders.id });

        await tx.insert(orderItems).values(
          items.map((i) => ({
            orderId: order.id,
            variantId: i.variantId,
            nameSnapshot: i.productName,
            skuSnapshot: i.sku,
            unitPricePaisa: i.pricePaisa,
            qty: i.qty,
          })),
        );

        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          toStatus: 'PAYMENT_PENDING',
        });

        createdOrders.push({
          orderId: order.id,
          sellerOrgId,
          totalPaisa: subtotal.toString(),
          status: 'PAYMENT_PENDING',
        });
      }

      // Create initial payment record (for the first order - will be split in real impl)
      // For prototype: one payment covers total across all orders
      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: createdOrders[0].orderId, // first order as primary
          provider: dto.paymentProvider,
          status: 'INITIATED',
          amountPaisa: totalPaisa,
          gatewayRef: null,
        })
        .returning({ id: payments.id });

      await tx.insert(paymentEvents).values({
        paymentId: payment.id,
        type: 'INITIATE',
        raw: {
          checkoutId: checkout.id,
          orderIds: createdOrders.map((o) => o.orderId),
          amountPaisa: totalPaisa.toString(),
        },
      });

      // Clear cart
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

      return {
        checkoutId: checkout.id,
        totalPaisa: totalPaisa.toString(),
        orders: createdOrders,
        payments: [
          {
            id: payment.id,
            orderId: createdOrders[0].orderId,
            amountPaisa: totalPaisa.toString(),
          },
        ],
        paymentId: payment.id,
        mockPaymentUrl: `/payment/mock/${payment.id}`,
      };
    });
  }
}
