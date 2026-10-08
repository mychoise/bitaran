import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  inventoryItems,
  stockMovements,
  productVariants,
  products,
} from '../../db/schema';

@Injectable()
export class InventoryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listStock(sellerOrgId: string): Promise<unknown[]> {
    return this.db
      .select({
        variantId: inventoryItems.variantId,
        sku: productVariants.sku,
        unit: productVariants.unit,
        productName: products.name,
        productId: products.id,
        qtyOnHand: inventoryItems.qtyOnHand,
        qtyReserved: inventoryItems.qtyReserved,
      })
      .from(inventoryItems)
      .innerJoin(productVariants, eq(inventoryItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(products.sellerOrgId, sellerOrgId));
  }

  async adjustStock(
    variantId: string,
    sellerOrgId: string,
    delta: number,
  ): Promise<unknown> {
    // Verify variant belongs to seller
    const variant = await this.db
      .select({ id: productVariants.id })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(products.sellerOrgId, sellerOrgId),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!variant) throw new NotFoundException('Variant not found');

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(inventoryItems)
        .set({
          qtyOnHand: sql`${inventoryItems.qtyOnHand} + ${delta}`,
        })
        .where(
          and(
            eq(inventoryItems.variantId, variantId),
            sql`${inventoryItems.qtyOnHand} + ${delta} >= ${inventoryItems.qtyReserved}`,
            sql`${inventoryItems.qtyOnHand} + ${delta} >= 0`,
          ),
        )
        .returning();

      if (!updated) {
        throw new BadRequestException(
          'Adjustment would result in negative available stock',
        );
      }

      await tx.insert(stockMovements).values({
        variantId,
        delta,
        reason: 'ADJUSTMENT',
      });

      return updated;
    });
  }
}
