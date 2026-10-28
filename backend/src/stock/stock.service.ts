import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { PG, pgErrorOf } from '../common/utils/pg-error.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import { products } from '../database/schema/index.js';

/** Largest value the integer stock_quantity column can hold. */
export const MAX_STOCK = 2_147_483_647;

/**
 * The one place products.stock_quantity changes after a product is created.
 * Every other module (adjustments now; sales, returns and write-offs later)
 * must go through here, passing its transaction when it has one.
 *
 * NOTE: there is no audit trail. An adjustment overwrites the quantity and
 * records nothing about who changed it, by how much, or why. Adding one needs
 * a stock-movements table; until then the history is not recoverable.
 */
@Injectable()
export class StockService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Adds `delta` (base units, may be negative) to a product's stock and
   * returns the new quantity. A single conditional UPDATE, so concurrent
   * adjustments cannot race each other below zero.
   */
  async adjust(
    businessId: string,
    productId: string,
    delta: number,
    executor: Database | Transaction = this.db,
  ): Promise<number> {
    const owned = and(
      eq(products.id, productId),
      eq(products.businessId, businessId),
    );
    let rows: { stockQuantity: number }[];
    try {
      rows = await executor
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(and(owned, gte(sql`${products.stockQuantity} + ${delta}`, 0)))
        .returning({ stockQuantity: products.stockQuantity });
    } catch (err) {
      if (pgErrorOf(err).code === PG.NUMERIC_OUT_OF_RANGE) {
        throw new ConflictException(
          errorBody(
            'STOCK_LIMIT_EXCEEDED',
            `Stock cannot exceed ${MAX_STOCK} units`,
          ),
        );
      }
      throw err;
    }
    if (rows.length) return rows[0].stockQuantity;

    // Nothing updated: either no such product here, or not enough stock.
    const [product] = await executor
      .select({ stockQuantity: products.stockQuantity })
      .from(products)
      .where(owned);
    if (!product) {
      throw new NotFoundException(
        errorBody('PRODUCT_NOT_FOUND', 'Product not found'),
      );
    }
    throw new ConflictException(
      errorBody(
        'INSUFFICIENT_STOCK',
        `Stock cannot go below zero: ${product.stockQuantity} in stock, adjustment of ${delta}`,
        [{ productId, stockQuantity: product.stockQuantity, delta }],
      ),
    );
  }
}
