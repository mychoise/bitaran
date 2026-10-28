import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import {
  isUniqueViolation,
  PG,
  pgErrorOf,
} from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import { productCategories, products } from '../database/schema/index.js';

const categoryColumns = {
  id: productCategories.id,
  name: productCategories.name,
  createdAt: productCategories.createdAt,
};

export const categoryNotFound = () =>
  new NotFoundException(
    errorBody('CATEGORY_NOT_FOUND', 'Product category not found'),
  );
const nameTaken = () =>
  new ConflictException(
    errorBody(
      'CATEGORY_NAME_TAKEN',
      'A category with this name already exists',
    ),
  );
const inUse = () =>
  new ConflictException(
    errorBody(
      'CATEGORY_IN_USE',
      'This category is used by products; move or recategorise them first',
    ),
  );

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list(businessId: string) {
    return this.db
      .select(categoryColumns)
      .from(productCategories)
      .where(eq(productCategories.businessId, businessId))
      .orderBy(asc(productCategories.name));
  }

  /** Throws CATEGORY_NOT_FOUND unless the category belongs to this business. */
  async assertOwned(
    businessId: string,
    id: string,
    executor: Database | Transaction = this.db,
  ): Promise<void> {
    const [row] = await executor
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(owned(businessId, id));
    if (!row) throw categoryNotFound();
  }

  async create(businessId: string, name: string) {
    try {
      const [row] = await this.db
        .insert(productCategories)
        .values({ id: randomUUID(), businessId, name, createdAt: new Date() })
        .returning(categoryColumns);
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  async rename(businessId: string, id: string, name: string) {
    try {
      const [row] = await this.db
        .update(productCategories)
        .set({ name })
        .where(owned(businessId, id))
        .returning(categoryColumns);
      if (!row) throw categoryNotFound();
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  /** Deletes an unused category. Any product, active or not, counts as a use. */
  async delete(businessId: string, id: string): Promise<void> {
    try {
      await withTransaction(this.db, async (tx) => {
        await this.assertOwned(businessId, id, tx);
        const [used] = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.businessId, businessId),
              eq(products.categoryId, id),
            ),
          )
          .limit(1);
        if (used) throw inUse();
        await tx.delete(productCategories).where(owned(businessId, id));
      });
    } catch (err) {
      // A product assigned concurrently trips the FK instead of the check.
      throw translate(err);
    }
  }
}

function owned(businessId: string, id: string) {
  return and(
    eq(productCategories.id, id),
    eq(productCategories.businessId, businessId),
  );
}

function translate(err: unknown): unknown {
  if (isUniqueViolation(err, 'idx_product_categories_business_name')) {
    return nameTaken();
  }
  if (pgErrorOf(err).code === PG.FOREIGN_KEY_VIOLATION) return inUse();
  return err;
}
