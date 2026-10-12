import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, ilike, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  products,
  productVariants,
  productImages,
  inventoryItems,
  categories,
  organizations,
} from '../../db/schema';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  CreateVariantDto,
} from './dto/catalog.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auditService: AuditService,
  ) {}

  // ---- Seller-facing ----

  async listMyProducts(sellerOrgId: string): Promise<unknown[]> {
    return this.db
      .select({
        id: products.id,
        name: products.name,
        status: products.status,
        categoryId: products.categoryId,
        categoryName: categories.name,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.sellerOrgId, sellerOrgId));
  }

  async getProduct(productId: string, sellerOrgId?: string): Promise<unknown> {
    const product = await this.db
      .select()
      .from(products)
      .where(
        sellerOrgId
          ? and(eq(products.id, productId), eq(products.sellerOrgId, sellerOrgId))
          : eq(products.id, productId),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!product) throw new NotFoundException('Product not found');

    const variants = await this.db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        unit: productVariants.unit,
        packSize: productVariants.packSize,
        pricePaisa: productVariants.pricePaisa,
        minOrderQty: productVariants.minOrderQty,
        isActive: productVariants.isActive,
        qtyOnHand: inventoryItems.qtyOnHand,
        qtyReserved: inventoryItems.qtyReserved,
      })
      .from(productVariants)
      .leftJoin(inventoryItems, eq(productVariants.id, inventoryItems.variantId))
      .where(eq(productVariants.productId, productId));

    const images = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId));

    return { ...product, variants, images };
  }

  private async ensureApprovedSeller(sellerOrgId: string): Promise<void> {
    const org = await this.db
      .select({
        id: organizations.id,
        status: organizations.status,
        canSell: organizations.canSell,
      })
      .from(organizations)
      .where(eq(organizations.id, sellerOrgId))
      .limit(1)
      .then((r) => r[0]);

    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (org.status !== 'APPROVED') {
      throw new ForbiddenException(
        'Your business account is pending approval. You cannot list or modify products until verified by an administrator.',
      );
    }
    if (!org.canSell) {
      throw new ForbiddenException(
        'Your organization does not have seller permissions enabled.',
      );
    }
  }

  async createProduct(
    sellerOrgId: string,
    dto: CreateProductDto,
    actorId?: string,
  ): Promise<unknown> {
    await this.ensureApprovedSeller(sellerOrgId);

    const product = await this.db.transaction(async (tx) => {
      const [newProd] = await tx
        .insert(products)
        .values({
          sellerOrgId,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId || null,
          status: dto.status ?? 'DRAFT',
        })
        .returning();

      if (dto.imageUrl) {
        await tx.insert(productImages).values({
          productId: newProd.id,
          url: dto.imageUrl,
          position: 0,
        });
      }

      if (dto.variants && dto.variants.length > 0) {
        const insertedVariants = await tx
          .insert(productVariants)
          .values(
            dto.variants.map((v) => ({
              productId: newProd.id,
              sku: v.sku,
              unit: v.unit,
              packSize: v.packSize,
              pricePaisa: v.pricePaisa,
              minOrderQty: v.minOrderQty,
              isActive: v.isActive ?? true,
            })),
          )
          .returning({ id: productVariants.id });

        await tx.insert(inventoryItems).values(
          insertedVariants.map((v) => ({ variantId: v.id })),
        );
      }

      return newProd;
    });

    await this.auditService.log({
      actorId,
      orgId: sellerOrgId,
      action: 'product.created',
      entity: 'product',
      entityId: product.id,
      meta: { name: product.name },
    });

    return product;
  }

  async updateProduct(
    productId: string,
    sellerOrgId: string,
    dto: UpdateProductDto,
    actorId?: string,
  ): Promise<unknown> {
    await this.ensureApprovedSeller(sellerOrgId);

    const existing = await this.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.id, productId), eq(products.sellerOrgId, sellerOrgId)),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!existing) throw new NotFoundException('Product not found');

    const [updated] = await this.db
      .update(products)
      .set({
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId !== undefined ? (dto.categoryId || null) : undefined,
        status: dto.status,
      })
      .where(eq(products.id, productId))
      .returning();

    if (dto.imageUrl !== undefined) {
      await this.db
        .delete(productImages)
        .where(eq(productImages.productId, productId));
      if (dto.imageUrl) {
        await this.db.insert(productImages).values({
          productId,
          url: dto.imageUrl,
          position: 0,
        });
      }
    }

    // Handle variant updates & price change auditing
    if (dto.variants && dto.variants.length > 0) {
      const existingVariants = await this.db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      for (const v of dto.variants) {
        const match = existingVariants.find((ev) => ev.sku === v.sku);
        if (match) {
          if (match.pricePaisa !== v.pricePaisa) {
            await this.auditService.log({
              actorId,
              orgId: sellerOrgId,
              action: 'product.price_changed',
              entity: 'product_variant',
              entityId: match.id,
              meta: {
                variantId: match.id,
                sku: match.sku,
                oldPricePaisa: match.pricePaisa.toString(),
                newPricePaisa: v.pricePaisa.toString(),
              },
            });
          }

          await this.db
            .update(productVariants)
            .set({
              unit: v.unit,
              packSize: v.packSize,
              pricePaisa: v.pricePaisa,
              minOrderQty: v.minOrderQty,
              isActive: v.isActive ?? true,
            })
            .where(eq(productVariants.id, match.id));
        } else {
          const [inserted] = await this.db
            .insert(productVariants)
            .values({
              productId,
              sku: v.sku,
              unit: v.unit,
              packSize: v.packSize,
              pricePaisa: v.pricePaisa,
              minOrderQty: v.minOrderQty,
              isActive: v.isActive ?? true,
            })
            .returning();

          await this.db.insert(inventoryItems).values({ variantId: inserted.id });
        }
      }
    }

    await this.auditService.log({
      actorId,
      orgId: sellerOrgId,
      action: 'product.updated',
      entity: 'product',
      entityId: productId,
      meta: { name: updated.name },
    });

    return updated;
  }

  async addVariant(
    productId: string,
    sellerOrgId: string,
    dto: CreateVariantDto,
    actorId?: string,
  ): Promise<unknown> {
    await this.ensureApprovedSeller(sellerOrgId);

    const product = await this.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.id, productId), eq(products.sellerOrgId, sellerOrgId)),
      )
      .limit(1)
      .then((r) => r[0]);

    if (!product) throw new NotFoundException('Product not found');

    const variant = await this.db.transaction(async (tx) => {
      const [newVar] = await tx
        .insert(productVariants)
        .values({
          productId,
          sku: dto.sku,
          unit: dto.unit,
          packSize: dto.packSize,
          pricePaisa: dto.pricePaisa,
          minOrderQty: dto.minOrderQty,
          isActive: dto.isActive ?? true,
        })
        .returning();

      await tx.insert(inventoryItems).values({ variantId: newVar.id });

      return newVar;
    });

    await this.auditService.log({
      actorId,
      orgId: sellerOrgId,
      action: 'product.variant_created',
      entity: 'product_variant',
      entityId: variant.id,
      meta: { sku: variant.sku, pricePaisa: variant.pricePaisa.toString() },
    });

    return variant;
  }

  // ---- Buyer-facing browse ----

  async browse(query: ProductQueryDto): Promise<unknown[]> {
    // Only show ACTIVE products from APPROVED sellers
    const conditions = [
      eq(products.status, 'ACTIVE'),
      eq(organizations.status, 'APPROVED'),
    ];

    if (query.categoryId) {
      conditions.push(eq(products.categoryId, query.categoryId));
    }
    if (query.sellerOrgId) {
      conditions.push(eq(products.sellerOrgId, query.sellerOrgId));
    }
    const searchTerm = query.search || query.q;
    if (searchTerm) {
      conditions.push(ilike(products.name, `%${searchTerm}%`));
    }

    const rows = await this.db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        sellerOrgId: products.sellerOrgId,
        sellerName: organizations.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
      })
      .from(products)
      .innerJoin(organizations, eq(products.sellerOrgId, organizations.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions));

    // Attach variants for each product
    const productIds = rows.map((r) => r.id);
    if (productIds.length === 0) return [];

    const allVariants = await this.db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        unit: productVariants.unit,
        packSize: productVariants.packSize,
        pricePaisa: productVariants.pricePaisa,
        minOrderQty: productVariants.minOrderQty,
        isActive: productVariants.isActive,
        qtyOnHand: inventoryItems.qtyOnHand,
        qtyReserved: inventoryItems.qtyReserved,
      })
      .from(productVariants)
      .leftJoin(inventoryItems, eq(productVariants.id, inventoryItems.variantId))
      .where(
        and(
          inArray(productVariants.productId, productIds),
          eq(productVariants.isActive, true),
        ),
      );

    const variantMap = new Map<string, typeof allVariants>();
    for (const v of allVariants) {
      const list = variantMap.get(v.productId) ?? [];
      list.push(v);
      variantMap.set(v.productId, list);
    }

    const images = await this.db
      .select({ productId: productImages.productId, url: productImages.url })
      .from(productImages)
      .where(inArray(productImages.productId, productIds));
    const imageMap = new Map(images.map((i) => [i.productId, i.url]));

    let result = rows.map((r) => {
      const pVariants = variantMap.get(r.id) ?? [];
      const cheapest =
        pVariants.length > 0
          ? pVariants.reduce(
              (min, v) => (v.pricePaisa < min.pricePaisa ? v : min),
              pVariants[0],
            )
          : null;

      return {
        ...r,
        variants: pVariants,
        pricePaisa: cheapest?.pricePaisa ?? 0,
        minOrderQty: cheapest?.minOrderQty ?? 1,
        imageUrl: imageMap.get(r.id) ?? null,
      };
    });

    if (query.sort === 'price_asc') {
      result.sort((a, b) => a.pricePaisa - b.pricePaisa);
    } else if (query.sort === 'price_desc') {
      result.sort((a, b) => b.pricePaisa - a.pricePaisa);
    }

    return result;
  }

  async getPublicProduct(productId: string): Promise<unknown> {
    return this.getProduct(productId);
  }

  async listCategories(): Promise<unknown[]> {
    return this.db.select().from(categories);
  }

  async listSellers(): Promise<unknown[]> {
    return this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(
        and(
          eq(organizations.status, 'APPROVED'),
          eq(organizations.canSell, true),
        ),
      );
  }
}
