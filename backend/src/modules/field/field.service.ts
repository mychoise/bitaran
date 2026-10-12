import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql, desc, asc, gte, lte, isNull, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  users,
  memberships,
  roles,
  products,
  productVariants,
  fieldSellers,
  fieldSales,
  fieldSaleItems,
  refreshTokens,
} from '../../db/schema';
import { CreateFieldSellerDto } from './dto/create-field-seller.dto';
import { UpdateFieldSellerDto } from './dto/update-field-seller.dto';
import { CreateFieldSaleDto } from './dto/create-field-sale.dto';
import { VoidFieldSaleDto } from './dto/void-field-sale.dto';
import { FieldSaleQueryDto, FieldAnalyticsQueryDto } from './dto/field-query.dto';

function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pass = '';
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

@Injectable()
export class FieldService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ----------------------------------------------------
  // FIELD SELLER APP METHODS (scoped to calling field seller)
  // ----------------------------------------------------

  async getFieldSellerProfile(userId: string) {
    const [seller] = await this.db
      .select()
      .from(fieldSellers)
      .where(eq(fieldSellers.userId, userId))
      .limit(1);

    if (!seller) {
      throw new ForbiddenException('Field seller profile not found');
    }
    return seller;
  }

  async getSummary(userId: string) {
    const seller = await this.getFieldSellerProfile(userId);

    // Kathmandu timezone bounds
    const [todayStats] = await this.db
      .select({
        totalPaisa: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, seller.id),
          eq(fieldSales.status, 'ACTIVE'),
          sql`date(${fieldSales.soldAt} at time zone 'Asia/Kathmandu') = date(now() at time zone 'Asia/Kathmandu')`,
        ),
      );

    const [allTimeStats] = await this.db
      .select({
        totalPaisa: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, seller.id),
          eq(fieldSales.status, 'ACTIVE'),
        ),
      );

    const [unitStats] = await this.db
      .select({
        units: sql<number>`coalesce(sum(${fieldSaleItems.qty}), 0)::int`,
      })
      .from(fieldSaleItems)
      .innerJoin(fieldSales, eq(fieldSaleItems.saleId, fieldSales.id))
      .where(
        and(
          eq(fieldSales.fieldSellerId, seller.id),
          eq(fieldSales.status, 'ACTIVE'),
        ),
      );

    return {
      todayTotalPaisa: todayStats?.totalPaisa ?? '0',
      todayCount: todayStats?.count ?? 0,
      allTimeTotalPaisa: allTimeStats?.totalPaisa ?? '0',
      allTimeCount: allTimeStats?.count ?? 0,
      allTimeUnits: unitStats?.units ?? 0,
    };
  }

  async getProducts(orgId: string) {
    const rows = await this.db
      .select({
        id: productVariants.id,
        productId: products.id,
        productName: products.name,
        sku: productVariants.sku,
        unit: productVariants.unit,
        packSize: productVariants.packSize,
        pricePaisa: productVariants.pricePaisa,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(products.sellerOrgId, orgId),
          eq(products.status, 'ACTIVE'),
          eq(productVariants.isActive, true),
        ),
      )
      .orderBy(asc(products.name), asc(productVariants.sku));

    return rows;
  }

  async createSale(userId: string, orgId: string, dto: CreateFieldSaleDto) {
    const seller = await this.getFieldSellerProfile(userId);
    if (seller.orgId !== orgId || seller.status !== 'ACTIVE') {
      throw new ForbiddenException('Invalid seller organization or inactive profile');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }
    if (dto.items.length > 50) {
      throw new BadRequestException('A sale cannot exceed 50 items');
    }

    const variantIds = dto.items.map((i) => i.variantId);
    const variantsInDb = await this.db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        unit: productVariants.unit,
        pricePaisa: productVariants.pricePaisa,
        isActive: productVariants.isActive,
        productName: products.name,
        sellerOrgId: products.sellerOrgId,
        productStatus: products.status,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          inArray(productVariants.id, variantIds),
          eq(products.sellerOrgId, orgId),
          eq(products.status, 'ACTIVE'),
          eq(productVariants.isActive, true),
        ),
      );

    const variantMap = new Map<string, (typeof variantsInDb)[0]>();
    for (const v of variantsInDb) {
      variantMap.set(v.variantId, v);
    }

    // Verify all items exist and belong to seller org
    for (const item of dto.items) {
      if (item.qty < 1 || item.qty > 10000) {
        throw new BadRequestException(`Invalid quantity ${item.qty} for variant ${item.variantId}`);
      }
      if (!variantMap.has(item.variantId)) {
        throw new BadRequestException(
          `Variant ${item.variantId} not found, inactive, or belongs to another business`,
        );
      }
    }

    // Compute server total
    let totalPaisaBigInt = 0n;
    const itemsToInsert: Array<{
      variantId: string;
      nameSnapshot: string;
      skuSnapshot: string;
      unitPricePaisa: number;
      qty: number;
    }> = [];

    for (const item of dto.items) {
      const v = variantMap.get(item.variantId)!;
      const linePaisa = BigInt(v.pricePaisa) * BigInt(item.qty);
      totalPaisaBigInt += linePaisa;

      itemsToInsert.push({
        variantId: v.variantId,
        nameSnapshot: v.productName,
        skuSnapshot: v.sku,
        unitPricePaisa: v.pricePaisa,
        qty: item.qty,
      });
    }

    // Insert sale and items atomically
    const sale = await this.db.transaction(async (tx) => {
      const [newSale] = await tx
        .insert(fieldSales)
        .values({
          orgId,
          fieldSellerId: seller.id,
          customerName: dto.customerName?.trim() || null,
          customerPhone: dto.customerPhone?.trim() || null,
          paymentMethod: dto.paymentMethod,
          totalPaisa: totalPaisaBigInt,
          status: 'ACTIVE',
          note: dto.note?.trim() || null,
          // soldAt defaults to now() on server
        })
        .returning();

      const insertedItems = await tx
        .insert(fieldSaleItems)
        .values(
          itemsToInsert.map((item) => ({
            ...item,
            saleId: newSale.id,
          })),
        )
        .returning();

      return {
        ...newSale,
        totalPaisa: newSale.totalPaisa.toString(),
        items: insertedItems,
      };
    });

    return sale;
  }

  async getOwnSales(userId: string, query: FieldSaleQueryDto) {
    const seller = await this.getFieldSellerProfile(userId);

    const conditions = [eq(fieldSales.fieldSellerId, seller.id)];

    if (query.from) {
      conditions.push(gte(fieldSales.soldAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(fieldSales.soldAt, new Date(query.to)));
    }
    if (query.status && query.status !== 'ALL') {
      conditions.push(eq(fieldSales.status, query.status));
    }

    const page = Math.max(1, query.page || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const salesList = await this.db
      .select()
      .from(fieldSales)
      .where(and(...conditions))
      .orderBy(desc(fieldSales.soldAt))
      .limit(limit)
      .offset(offset);

    if (salesList.length === 0) {
      return [];
    }

    const saleIds = salesList.map((s) => s.id);
    const items = await this.db
      .select()
      .from(fieldSaleItems)
      .where(inArray(fieldSaleItems.saleId, saleIds));

    const itemsBySale = new Map<string, typeof items>();
    for (const item of items) {
      const arr = itemsBySale.get(item.saleId) ?? [];
      arr.push(item);
      itemsBySale.set(item.saleId, arr);
    }

    return salesList.map((s) => ({
      ...s,
      totalPaisa: s.totalPaisa.toString(),
      items: itemsBySale.get(s.id) ?? [],
    }));
  }

  // ----------------------------------------------------
  // OWNER METHODS (scoped to active business orgId)
  // ----------------------------------------------------

  async createFieldSeller(
    creatorUserId: string,
    orgId: string,
    dto: CreateFieldSellerDto,
  ) {
    const cleanUsername = dto.username.trim().toLowerCase();

    // Check username uniqueness
    const existingUser = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${cleanUsername}`)
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('Username already taken');
    }

    if (dto.phone) {
      const existingPhone = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, dto.phone.trim()))
        .limit(1);
      if (existingPhone.length > 0) {
        throw new ConflictException('Phone number already in use');
      }
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const fieldSellerRole = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'FIELD_SELLER'))
      .limit(1)
      .then((r) => r[0]);

    if (!fieldSellerRole) {
      throw new Error('FIELD_SELLER role not found in database');
    }

    const result = await this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: dto.displayName.trim(),
          username: cleanUsername,
          phone: dto.phone?.trim() || null,
          passwordHash,
          mustChangePassword: true,
          status: 'ACTIVE',
        })
        .returning();

      await tx.insert(memberships).values({
        userId: newUser.id,
        orgId,
        roleId: fieldSellerRole.id,
      });

      const [newFieldSeller] = await tx
        .insert(fieldSellers)
        .values({
          userId: newUser.id,
          orgId,
          displayName: dto.displayName.trim(),
          phone: dto.phone?.trim() || null,
          status: 'ACTIVE',
          createdByUserId: creatorUserId,
        })
        .returning();

      return {
        ...newFieldSeller,
        username: newUser.username,
        temporaryPassword: tempPassword,
      };
    });

    return result;
  }

  async listFieldSellers(orgId: string) {
    const sellers = await this.db
      .select({
        id: fieldSellers.id,
        userId: fieldSellers.userId,
        orgId: fieldSellers.orgId,
        displayName: fieldSellers.displayName,
        phone: fieldSellers.phone,
        status: fieldSellers.status,
        createdAt: fieldSellers.createdAt,
        username: users.username,
      })
      .from(fieldSellers)
      .innerJoin(users, eq(fieldSellers.userId, users.id))
      .where(eq(fieldSellers.orgId, orgId))
      .orderBy(desc(fieldSellers.createdAt));

    if (sellers.length === 0) {
      return [];
    }

    // Aggregations per seller
    const todayAggs = await this.db
      .select({
        fieldSellerId: fieldSales.fieldSellerId,
        amount: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.orgId, orgId),
          eq(fieldSales.status, 'ACTIVE'),
          sql`date(${fieldSales.soldAt} at time zone 'Asia/Kathmandu') = date(now() at time zone 'Asia/Kathmandu')`,
        ),
      )
      .groupBy(fieldSales.fieldSellerId);

    const monthAggs = await this.db
      .select({
        fieldSellerId: fieldSales.fieldSellerId,
        amount: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.orgId, orgId),
          eq(fieldSales.status, 'ACTIVE'),
          sql`date_trunc('month', ${fieldSales.soldAt} at time zone 'Asia/Kathmandu') = date_trunc('month', now() at time zone 'Asia/Kathmandu')`,
        ),
      )
      .groupBy(fieldSales.fieldSellerId);

    const allTimeAggs = await this.db
      .select({
        fieldSellerId: fieldSales.fieldSellerId,
        amount: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.orgId, orgId),
          eq(fieldSales.status, 'ACTIVE'),
        ),
      )
      .groupBy(fieldSales.fieldSellerId);

    const todayMap = new Map(todayAggs.map((a) => [a.fieldSellerId, a]));
    const monthMap = new Map(monthAggs.map((a) => [a.fieldSellerId, a]));
    const allTimeMap = new Map(allTimeAggs.map((a) => [a.fieldSellerId, a]));

    return sellers.map((s) => ({
      ...s,
      soldToday: {
        paisa: todayMap.get(s.id)?.amount ?? '0',
        count: todayMap.get(s.id)?.count ?? 0,
      },
      soldThisMonth: {
        paisa: monthMap.get(s.id)?.amount ?? '0',
        count: monthMap.get(s.id)?.count ?? 0,
      },
      soldAllTime: {
        paisa: allTimeMap.get(s.id)?.amount ?? '0',
        count: allTimeMap.get(s.id)?.count ?? 0,
      },
    }));
  }

  async getFieldSeller(orgId: string, id: string) {
    const [seller] = await this.db
      .select({
        id: fieldSellers.id,
        userId: fieldSellers.userId,
        orgId: fieldSellers.orgId,
        displayName: fieldSellers.displayName,
        phone: fieldSellers.phone,
        status: fieldSellers.status,
        createdAt: fieldSellers.createdAt,
        username: users.username,
      })
      .from(fieldSellers)
      .innerJoin(users, eq(fieldSellers.userId, users.id))
      .where(and(eq(fieldSellers.id, id), eq(fieldSellers.orgId, orgId)))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Field seller not found');
    }

    // Overview stats
    const [todayAgg] = await this.db
      .select({
        paisa: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, id),
          eq(fieldSales.status, 'ACTIVE'),
          sql`date(${fieldSales.soldAt} at time zone 'Asia/Kathmandu') = date(now() at time zone 'Asia/Kathmandu')`,
        ),
      );

    const [monthAgg] = await this.db
      .select({
        paisa: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, id),
          eq(fieldSales.status, 'ACTIVE'),
          sql`date_trunc('month', ${fieldSales.soldAt} at time zone 'Asia/Kathmandu') = date_trunc('month', now() at time zone 'Asia/Kathmandu')`,
        ),
      );

    const [allTimeAgg] = await this.db
      .select({
        paisa: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, id),
          eq(fieldSales.status, 'ACTIVE'),
        ),
      );

    const count = allTimeAgg?.count || 0;
    const allPaisa = BigInt(allTimeAgg?.paisa || '0');
    const averageSale = count > 0 ? (allPaisa / BigInt(count)).toString() : '0';

    // Revenue by day for the past 14 days
    const revenueByDay = await this.db
      .select({
        date: sql<string>`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`,
        revenue: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        salesCount: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(
        and(
          eq(fieldSales.fieldSellerId, id),
          eq(fieldSales.status, 'ACTIVE'),
          sql`${fieldSales.soldAt} >= now() - interval '14 days'`,
        ),
      )
      .groupBy(sql`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`);

    return {
      ...seller,
      overview: {
        today: todayAgg?.paisa ?? '0',
        thisMonth: monthAgg?.paisa ?? '0',
        toDate: allTimeAgg?.paisa ?? '0',
        salesCount: count,
        averageSale,
        revenueByDay,
      },
    };
  }

  async updateFieldSeller(orgId: string, id: string, dto: UpdateFieldSellerDto) {
    const [seller] = await this.db
      .select()
      .from(fieldSellers)
      .where(and(eq(fieldSellers.id, id), eq(fieldSellers.orgId, orgId)))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Field seller not found');
    }

    const updates: Partial<{ displayName: string; phone: string | null }> = {};
    if (dto.displayName !== undefined) updates.displayName = dto.displayName.trim();
    if (dto.phone !== undefined) updates.phone = dto.phone?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return seller;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(fieldSellers)
        .set(updates)
        .where(eq(fieldSellers.id, id));

      const userUpdates: Partial<{ name: string; phone: string | null }> = {};
      if (updates.displayName) userUpdates.name = updates.displayName;
      if (dto.phone !== undefined) userUpdates.phone = updates.phone;

      if (Object.keys(userUpdates).length > 0) {
        await tx.update(users).set(userUpdates).where(eq(users.id, seller.userId));
      }
    });

    return this.getFieldSeller(orgId, id);
  }

  async disableFieldSeller(orgId: string, id: string) {
    const [seller] = await this.db
      .select()
      .from(fieldSellers)
      .where(and(eq(fieldSellers.id, id), eq(fieldSellers.orgId, orgId)))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Field seller not found');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(fieldSellers)
        .set({ status: 'DISABLED' })
        .where(eq(fieldSellers.id, id));

      await tx
        .update(users)
        .set({ status: 'DISABLED' })
        .where(eq(users.id, seller.userId));

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, seller.userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    });

    return { message: 'Field seller disabled' };
  }

  async enableFieldSeller(orgId: string, id: string) {
    const [seller] = await this.db
      .select()
      .from(fieldSellers)
      .where(and(eq(fieldSellers.id, id), eq(fieldSellers.orgId, orgId)))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Field seller not found');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(fieldSellers)
        .set({ status: 'ACTIVE' })
        .where(eq(fieldSellers.id, id));

      await tx
        .update(users)
        .set({ status: 'ACTIVE' })
        .where(eq(users.id, seller.userId));
    });

    return { message: 'Field seller enabled' };
  }

  async resetPassword(orgId: string, id: string) {
    const [seller] = await this.db
      .select()
      .from(fieldSellers)
      .where(and(eq(fieldSellers.id, id), eq(fieldSellers.orgId, orgId)))
      .limit(1);

    if (!seller) {
      throw new NotFoundException('Field seller not found');
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, mustChangePassword: true })
        .where(eq(users.id, seller.userId));

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, seller.userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    });

    return { temporaryPassword: tempPassword };
  }

  async listSellerFieldSales(orgId: string, query: FieldSaleQueryDto) {
    const conditions = [eq(fieldSales.orgId, orgId)];

    if (query.fieldSellerId) {
      conditions.push(eq(fieldSales.fieldSellerId, query.fieldSellerId));
    }
    if (query.from) {
      conditions.push(gte(fieldSales.soldAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(fieldSales.soldAt, new Date(query.to)));
    }
    if (query.status && query.status !== 'ALL') {
      conditions.push(eq(fieldSales.status, query.status));
    }

    const page = Math.max(1, query.page || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const salesList = await this.db
      .select({
        id: fieldSales.id,
        orgId: fieldSales.orgId,
        fieldSellerId: fieldSales.fieldSellerId,
        sellerName: fieldSellers.displayName,
        customerName: fieldSales.customerName,
        customerPhone: fieldSales.customerPhone,
        paymentMethod: fieldSales.paymentMethod,
        totalPaisa: fieldSales.totalPaisa,
        status: fieldSales.status,
        voidReason: fieldSales.voidReason,
        voidedByUserId: fieldSales.voidedByUserId,
        voidedAt: fieldSales.voidedAt,
        note: fieldSales.note,
        soldAt: fieldSales.soldAt,
        createdAt: fieldSales.createdAt,
      })
      .from(fieldSales)
      .innerJoin(fieldSellers, eq(fieldSales.fieldSellerId, fieldSellers.id))
      .where(and(...conditions))
      .orderBy(desc(fieldSales.soldAt))
      .limit(limit)
      .offset(offset);

    if (salesList.length === 0) {
      return [];
    }

    const saleIds = salesList.map((s) => s.id);
    const items = await this.db
      .select()
      .from(fieldSaleItems)
      .where(inArray(fieldSaleItems.saleId, saleIds));

    const itemsBySale = new Map<string, typeof items>();
    for (const item of items) {
      const arr = itemsBySale.get(item.saleId) ?? [];
      arr.push(item);
      itemsBySale.set(item.saleId, arr);
    }

    return salesList.map((s) => ({
      ...s,
      totalPaisa: s.totalPaisa.toString(),
      items: itemsBySale.get(s.id) ?? [],
    }));
  }

  async voidSale(
    orgId: string,
    saleId: string,
    voidedByUserId: string,
    dto: VoidFieldSaleDto,
  ) {
    const [sale] = await this.db
      .select()
      .from(fieldSales)
      .where(and(eq(fieldSales.id, saleId), eq(fieldSales.orgId, orgId)))
      .limit(1);

    if (!sale) {
      throw new NotFoundException('Field sale not found');
    }

    const [updated] = await this.db
      .update(fieldSales)
      .set({
        status: 'VOIDED',
        voidReason: dto.reason.trim(),
        voidedByUserId,
        voidedAt: new Date(),
      })
      .where(eq(fieldSales.id, saleId))
      .returning();

    return {
      ...updated,
      totalPaisa: updated.totalPaisa.toString(),
    };
  }

  async getFieldAnalytics(orgId: string, query: FieldAnalyticsQueryDto) {
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = query.to ? new Date(query.to) : new Date();

    const baseConditions = [
      eq(fieldSales.orgId, orgId),
      eq(fieldSales.status, 'ACTIVE'),
      gte(fieldSales.soldAt, fromDate),
      lte(fieldSales.soldAt, toDate),
    ];

    if (query.fieldSellerId) {
      baseConditions.push(eq(fieldSales.fieldSellerId, query.fieldSellerId));
    }

    // 1. Totals
    const [salesAgg] = await this.db
      .select({
        revenue: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        salesCount: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(and(...baseConditions));

    const [unitsAgg] = await this.db
      .select({
        units: sql<number>`coalesce(sum(${fieldSaleItems.qty}), 0)::int`,
      })
      .from(fieldSaleItems)
      .innerJoin(fieldSales, eq(fieldSaleItems.saleId, fieldSales.id))
      .where(and(...baseConditions));

    const totalRevenue = BigInt(salesAgg?.revenue || '0');
    const totalCount = salesAgg?.salesCount || 0;
    const avgSaleValue =
      totalCount > 0 ? (totalRevenue / BigInt(totalCount)).toString() : '0';

    const totals = {
      revenue: totalRevenue.toString(),
      salesCount: totalCount,
      units: unitsAgg?.units || 0,
      avgSaleValue,
    };

    // 2. By Seller
    const bySellerRaw = await this.db
      .select({
        sellerId: fieldSellers.id,
        displayName: fieldSellers.displayName,
        username: users.username,
        revenue: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        salesCount: sql<number>`count(distinct ${fieldSales.id})::int`,
      })
      .from(fieldSales)
      .innerJoin(fieldSellers, eq(fieldSales.fieldSellerId, fieldSellers.id))
      .innerJoin(users, eq(fieldSellers.userId, users.id))
      .where(and(...baseConditions))
      .groupBy(fieldSellers.id, fieldSellers.displayName, users.username)
      .orderBy(sql`sum(${fieldSales.totalPaisa}) desc`);

    // Units per seller
    const sellerUnits = await this.db
      .select({
        sellerId: fieldSales.fieldSellerId,
        units: sql<number>`coalesce(sum(${fieldSaleItems.qty}), 0)::int`,
      })
      .from(fieldSaleItems)
      .innerJoin(fieldSales, eq(fieldSaleItems.saleId, fieldSales.id))
      .where(and(...baseConditions))
      .groupBy(fieldSales.fieldSellerId);

    const unitsBySellerMap = new Map(sellerUnits.map((u) => [u.sellerId, u.units]));

    const bySeller = bySellerRaw.map((s) => {
      const rev = BigInt(s.revenue || '0');
      const sc = s.salesCount || 0;
      return {
        seller: {
          id: s.sellerId,
          displayName: s.displayName,
          username: s.username,
        },
        revenue: rev.toString(),
        salesCount: sc,
        units: unitsBySellerMap.get(s.sellerId) || 0,
        avgSaleValue: sc > 0 ? (rev / BigInt(sc)).toString() : '0',
      };
    });

    // 3. By Day (Asia/Kathmandu)
    const byDayRaw = await this.db
      .select({
        date: sql<string>`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`,
        revenue: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        salesCount: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(and(...baseConditions))
      .groupBy(sql`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${fieldSales.soldAt} at time zone 'Asia/Kathmandu', 'YYYY-MM-DD') asc`);

    const byDay = byDayRaw.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      salesCount: d.salesCount,
    }));

    // 4. Top Products (top 10)
    const topProductsRaw = await this.db
      .select({
        productName: fieldSaleItems.nameSnapshot,
        units: sql<number>`coalesce(sum(${fieldSaleItems.qty}), 0)::int`,
        revenue: sql<string>`coalesce(sum((${fieldSaleItems.unitPricePaisa}::bigint) * (${fieldSaleItems.qty}::bigint)), 0)::text`,
      })
      .from(fieldSaleItems)
      .innerJoin(fieldSales, eq(fieldSaleItems.saleId, fieldSales.id))
      .where(and(...baseConditions))
      .groupBy(fieldSaleItems.nameSnapshot)
      .orderBy(sql`sum(${fieldSaleItems.qty}) desc`)
      .limit(10);

    const topProducts = topProductsRaw.map((p) => ({
      productName: p.productName,
      units: p.units,
      revenue: p.revenue,
    }));

    // 5. By Payment Method
    const byPaymentMethodRaw = await this.db
      .select({
        method: fieldSales.paymentMethod,
        revenue: sql<string>`coalesce(sum(${fieldSales.totalPaisa}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(fieldSales)
      .where(and(...baseConditions))
      .groupBy(fieldSales.paymentMethod)
      .orderBy(sql`sum(${fieldSales.totalPaisa}) desc`);

    const byPaymentMethod = byPaymentMethodRaw.map((pm) => ({
      method: pm.method,
      revenue: pm.revenue,
      count: pm.count,
    }));

    return {
      totals,
      bySeller,
      byDay,
      topProducts,
      byPaymentMethod,
    };
  }
}
