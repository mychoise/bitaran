import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, ilike, or, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { definedOnly } from '../common/utils/object.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import {
  isUniqueViolation,
  PG,
  pgErrorOf,
} from '../common/utils/pg-error.util.js';
import { likeContains } from '../common/utils/search.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { products } from '../database/schema/index.js';
import { StockService } from '../stock/stock.service.js';
import { CategoriesService, categoryNotFound } from './categories.service.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/product.dto.js';

const { costPricePaisa, ...salesmanColumns } = {
  id: products.id,
  categoryId: products.categoryId,
  name: products.name,
  description: products.description,
  brand: products.brand,
  sku: products.sku,
  barcode: products.barcode,
  imageKey: products.imageKey,
  unit: products.unit,
  unitsPerCarton: products.unitsPerCarton,
  pricePaisa: products.pricePaisa,
  cartonPricePaisa: products.cartonPricePaisa,
  mrpPaisa: products.mrpPaisa,
  costPricePaisa: products.costPricePaisa,
  stockQuantity: products.stockQuantity,
  lowStockAlert: products.lowStockAlert,
  isActive: products.isActive,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};
const managerColumns = { ...salesmanColumns, costPricePaisa };

/**
 * Salesmen never see cost price. The column is left out of the SELECT itself
 * rather than stripped afterwards, so it cannot leak through a forgotten path.
 */
const columnsFor = (actor: StaffTokenPayload) =>
  actor.role === 'salesman' ? salesmanColumns : managerColumns;

const notFound = () =>
  new NotFoundException(errorBody('PRODUCT_NOT_FOUND', 'Product not found'));
const skuTaken = () =>
  new ConflictException(
    errorBody('SKU_TAKEN', 'Another product in this business has this SKU'),
  );

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly categories: CategoriesService,
    private readonly stock: StockService,
  ) {}

  async list(actor: StaffTokenPayload, query: ListProductsQueryDto) {
    const filters: (SQL | undefined)[] = [
      eq(products.businessId, actor.businessId),
    ];
    if (query.search) {
      const pattern = likeContains(query.search);
      filters.push(
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.barcode, pattern),
        ),
      );
    }
    if (query.categoryId)
      filters.push(eq(products.categoryId, query.categoryId));
    if (query.isActive !== undefined) {
      filters.push(eq(products.isActive, query.isActive));
    }
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(columnsFor(actor))
        .from(products)
        .where(where)
        .orderBy(asc(products.name), asc(products.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  async get(actor: StaffTokenPayload, id: string) {
    const [row] = await this.db
      .select(columnsFor(actor))
      .from(products)
      .where(owned(actor.businessId, id));
    if (!row) throw notFound();
    return row;
  }

  async create(actor: StaffTokenPayload, dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.categories.assertOwned(actor.businessId, dto.categoryId);
    }
    const now = new Date();
    try {
      const [row] = await this.db
        .insert(products)
        .values({
          ...definedOnly(dto),
          name: dto.name,
          pricePaisa: dto.pricePaisa,
          id: randomUUID(),
          businessId: actor.businessId,
          createdAt: now,
          updatedAt: now,
        })
        .returning(columnsFor(actor));
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  async update(actor: StaffTokenPayload, id: string, dto: UpdateProductDto) {
    const changes = definedOnly(dto);
    if (Object.keys(changes).length === 0) return this.get(actor, id);
    if (changes.categoryId) {
      await this.categories.assertOwned(actor.businessId, changes.categoryId);
    }
    try {
      const [row] = await this.db
        .update(products)
        .set({ ...changes, updatedAt: new Date() })
        .where(owned(actor.businessId, id))
        .returning(columnsFor(actor));
      if (!row) throw notFound();
      return row;
    } catch (err) {
      throw translate(err);
    }
  }

  async adjustStock(actor: StaffTokenPayload, id: string, delta: number) {
    return withTransaction(this.db, async (tx) => {
      await this.stock.adjust(actor.businessId, id, delta, tx);
      const [row] = await tx
        .select(columnsFor(actor))
        .from(products)
        .where(owned(actor.businessId, id));
      return row;
    });
  }
}

function owned(businessId: string, id: string) {
  return and(eq(products.id, id), eq(products.businessId, businessId));
}

function translate(err: unknown): unknown {
  if (isUniqueViolation(err, 'idx_products_business_sku')) return skuTaken();
  // The category was deleted between the ownership check and this write.
  if (pgErrorOf(err).code === PG.FOREIGN_KEY_VIOLATION) {
    return categoryNotFound();
  }
  return err;
}
