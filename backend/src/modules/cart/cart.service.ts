import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  carts,
  cartItems,
  productVariants,
  products,
  productImages,
  inventoryItems,
  organizations,
} from '../../db/schema';

@Injectable()
export class CartService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async getOrCreateCart(buyerOrgId: string): Promise<string> {
    const existing = await this.db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.buyerOrgId, buyerOrgId))
      .limit(1)
      .then((r) => r[0]);

    if (existing) return existing.id;

    const [created] = await this.db
      .insert(carts)
      .values({ buyerOrgId })
      .returning({ id: carts.id });
    return created.id;
  }

  async getCart(buyerOrgId: string): Promise<unknown> {
    const cartId = await this.getOrCreateCart(buyerOrgId);

    const items = await this.db
      .select({
        id: cartItems.id,
        variantId: cartItems.variantId,
        qty: cartItems.qty,
        sku: productVariants.sku,
        unit: productVariants.unit,
        packSize: productVariants.packSize,
        pricePaisa: productVariants.pricePaisa,
        minOrderQty: productVariants.minOrderQty,
        productId: products.id,
        productName: products.name,
        sellerOrgId: products.sellerOrgId,
        sellerName: organizations.name,
        qtyOnHand: inventoryItems.qtyOnHand,
        qtyReserved: inventoryItems.qtyReserved,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(organizations, eq(products.sellerOrgId, organizations.id))
      .leftJoin(inventoryItems, eq(productVariants.id, inventoryItems.variantId))
      .where(eq(cartItems.cartId, cartId));

    // Get images for products
    const productIds = [...new Set(items.map((i) => i.productId))];
    const imageMap = new Map<string, string>();
    if (productIds.length > 0) {
      const images = await this.db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(
          productIds.length === 1
            ? eq(productImages.productId, productIds[0])
            : eq(productImages.productId, productIds[0]), // simplified for now
        );
      images.forEach((img) => imageMap.set(img.productId, img.url));
    }

    // Group by seller
    const sellerMap = new Map<
      string,
      { sellerOrgId: string; sellerName: string; items: unknown[] }
    >();
    for (const item of items) {
      if (!sellerMap.has(item.sellerOrgId)) {
        sellerMap.set(item.sellerOrgId, {
          sellerOrgId: item.sellerOrgId,
          sellerName: item.sellerName,
          items: [],
        });
      }
      const available =
        (item.qtyOnHand ?? 0) - (item.qtyReserved ?? 0);
      sellerMap.get(item.sellerOrgId)!.items.push({
        ...item,
        imageUrl: imageMap.get(item.productId) ?? null,
        lineTotalPaisa: item.pricePaisa * item.qty,
        availableQty: available,
      });
    }

    return {
      cartId,
      groups: Array.from(sellerMap.values()),
    };
  }

  async upsertItem(
    buyerOrgId: string,
    variantId: string,
    qty: number,
  ): Promise<unknown> {
    const buyerOrg = await this.db
      .select({ id: organizations.id, status: organizations.status, canBuy: organizations.canBuy })
      .from(organizations)
      .where(eq(organizations.id, buyerOrgId))
      .limit(1)
      .then((r) => r[0]);

    if (!buyerOrg || buyerOrg.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Your business account is pending approval. You cannot add items to cart or order until verified by an administrator.',
      );
    }
    if (!buyerOrg.canBuy) {
      throw new ForbiddenException(
        'Your organization does not have buyer permissions enabled.',
      );
    }

    // Validate variant exists and is active
    const variant = await this.db
      .select({
        id: productVariants.id,
        minOrderQty: productVariants.minOrderQty,
        isActive: productVariants.isActive,
        sellerOrgId: products.sellerOrgId,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, variantId))
      .limit(1)
      .then((r) => r[0]);

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Variant not found or inactive');
    }

    if (variant.sellerOrgId === buyerOrgId) {
      throw new BadRequestException('Cannot buy from your own organization');
    }

    if (qty < variant.minOrderQty) {
      throw new BadRequestException(
        `Minimum order quantity is ${String(variant.minOrderQty)}`,
      );
    }

    const cartId = await this.getOrCreateCart(buyerOrgId);

    const existing = await this.db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      const [updated] = await this.db
        .update(cartItems)
        .set({ qty })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(cartItems)
        .values({ cartId, variantId, qty })
        .returning();
      return created;
    }
  }

  async removeItem(buyerOrgId: string, variantId: string): Promise<void> {
    const cartId = await this.getOrCreateCart(buyerOrgId);
    await this.db
      .delete(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)),
      );
  }

  async clearCart(buyerOrgId: string): Promise<void> {
    const cartId = await this.getOrCreateCart(buyerOrgId);
    await this.db.delete(cartItems).where(eq(cartItems.cartId, cartId));
  }
}
