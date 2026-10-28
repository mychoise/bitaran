import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { Database } from '../src/database/database.types.js';
import {
  productCategories,
  products,
  users,
} from '../src/database/schema/index.js';
import { seed, SeedResult } from '../src/database/seed/seed.js';
import { MAX_STOCK } from '../src/stock/stock.service.js';
import { staffToken } from './utils/auth.js';
import {
  insertBusiness,
  insertProduct,
  insertUser,
} from './utils/factories.js';
import { createTestApp } from './utils/test-app.js';
import { truncateAll } from './utils/test-db.js';

type Product = typeof products.$inferSelect;
type Category = typeof productCategories.$inferSelect;

const PRODUCTS = '/api/v1/products';
const CATEGORIES = '/api/v1/product-categories';

describe('Catalog (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let seeded: SeedResult;
  let aCategory: Category;
  let aProducts: Product[];
  let b: { category: Category; product: Product };
  const tokens = {} as Record<
    'aOwner' | 'aManager' | 'aSalesman' | 'bOwner',
    string
  >;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => http().get(url).auth(token, { type: 'bearer' }),
    post: (url: string, body: object = {}) =>
      http().post(url).auth(token, { type: 'bearer' }).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).auth(token, { type: 'bearer' }).send(body),
    delete: (url: string) => http().delete(url).auth(token, { type: 'bearer' }),
  });
  const productRow = async (id: string) =>
    (await db.select().from(products).where(eq(products.id, id)))[0];
  const adjust = (token: string, id: string, delta: unknown) =>
    as(token).post(`${PRODUCTS}/${id}/stock-adjust`, { delta });
  const newProduct = (overrides: object = {}) => ({
    name: 'Peanut Butter 340g',
    pricePaisa: 45_000,
    costPricePaisa: 38_000,
    ...overrides,
  });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });
  beforeEach(async () => {
    await truncateAll(db);
    seeded = await seed(db);
    const staff = await db
      .select()
      .from(users)
      .where(eq(users.businessId, seeded.businessId));
    const byRole = (r: string) => staff.find((u) => u.role === r)!;
    tokens.aOwner = await staffToken(app, byRole('owner'));
    tokens.aManager = await staffToken(app, byRole('manager'));
    tokens.aSalesman = await staffToken(app, byRole('salesman'));
    [aCategory] = await db.select().from(productCategories);
    aProducts = await db.select().from(products);

    const bBusiness = await insertBusiness(db, { name: 'Other Traders' });
    tokens.bOwner = await staffToken(
      app,
      await insertUser(db, bBusiness.id, { role: 'owner' }),
    );
    const [bCategory] = await db
      .insert(productCategories)
      .values({
        id: randomUUID(),
        businessId: bBusiness.id,
        name: 'B Category',
        createdAt: new Date(),
      })
      .returning();
    b = {
      category: bCategory,
      product: await insertProduct(db, bBusiness.id, {
        name: 'B Secret Product',
        sku: 'NDL-70', // same SKU as one of A's: allowed across businesses
        categoryId: bCategory.id,
        costPricePaisa: 999,
        stockQuantity: 50,
      }),
    };
  });
  afterAll(() => app.close());

  describe('cost price is hidden from salesmen', () => {
    const expectNoCost = (text: string) => {
      expect(text).not.toMatch(/costPrice|cost_price/i);
    };

    it('is absent from every product response a salesman gets', async () => {
      const s = as(tokens.aSalesman);
      const id = aProducts[0].id;
      const responses = [
        await s.get(PRODUCTS).expect(200),
        await s.get(`${PRODUCTS}?search=noodle&isActive=true`).expect(200),
        await s.get(`${PRODUCTS}?categoryId=${aCategory.id}`).expect(200),
        await s.get(`${PRODUCTS}/${id}`).expect(200),
        // Refused writes must not echo the product either.
        await s.patch(`${PRODUCTS}/${id}`, { name: 'x' }).expect(403),
        await adjust(tokens.aSalesman, id, 1).expect(403),
        await s.post(PRODUCTS, newProduct()).expect(403),
      ];
      for (const res of responses) expectNoCost(res.text);
      expect(responses[0].body.data).toHaveLength(5);
      expect(responses[3].body).toMatchObject({
        id,
        pricePaisa: aProducts[0].pricePaisa,
      });
    });

    it('is present for managers and owners', async () => {
      for (const token of [tokens.aManager, tokens.aOwner]) {
        const res = await as(token).get(PRODUCTS).expect(200);
        for (const p of res.body.data) {
          expect(p.costPricePaisa).toEqual(expect.any(Number));
        }
      }
    });
  });

  describe('stock', () => {
    it('sets opening stock on create, defaulting to zero', async () => {
      const withStock = await as(tokens.aManager)
        .post(PRODUCTS, newProduct({ stockQuantity: 120 }))
        .expect(201);
      expect(withStock.body.stockQuantity).toBe(120);
      const without = await as(tokens.aManager)
        .post(PRODUCTS, newProduct({ name: 'Jam' }))
        .expect(201);
      expect(without.body).toMatchObject({ stockQuantity: 0, unit: 'piece' });
    });

    it('cannot be changed through PATCH', async () => {
      const id = aProducts[0].id;
      const res = await as(tokens.aOwner)
        .patch(`${PRODUCTS}/${id}`, { stockQuantity: 1 })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect((await productRow(id)).stockQuantity).toBe(
        aProducts[0].stockQuantity,
      );
    });

    it('adjusts by a signed delta and returns the product', async () => {
      const p = await insertProduct(db, seeded.businessId, {
        stockQuantity: 10,
      });
      const up = await adjust(tokens.aManager, p.id, 5).expect(200);
      expect(up.body).toMatchObject({ id: p.id, stockQuantity: 15 });
      const down = await adjust(tokens.aOwner, p.id, -15).expect(200);
      expect(down.body.stockQuantity).toBe(0);
    });

    it('cannot go below zero', async () => {
      const p = await insertProduct(db, seeded.businessId, {
        stockQuantity: 3,
      });
      const res = await adjust(tokens.aManager, p.id, -4).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        details: [{ stockQuantity: 3, delta: -4 }],
      });
      expect((await productRow(p.id)).stockQuantity).toBe(3);
    });

    it('cannot go below zero under concurrent adjustments', async () => {
      const p = await insertProduct(db, seeded.businessId, {
        stockQuantity: 10,
      });
      const results = await Promise.all(
        Array.from({ length: 6 }, () => adjust(tokens.aManager, p.id, -3)),
      );
      const statuses = results.map((r) => r.status).sort((x, y) => x - y);
      expect(statuses).toEqual([200, 200, 200, 409, 409, 409]);
      expect((await productRow(p.id)).stockQuantity).toBe(1);
    });

    it('rejects an adjustment that would overflow the column', async () => {
      const p = await insertProduct(db, seeded.businessId, {
        stockQuantity: MAX_STOCK - 1,
      });
      const res = await adjust(tokens.aManager, p.id, 2).expect(409);
      expect(res.body.error.code).toBe('STOCK_LIMIT_EXCEEDED');
    });

    it.each([0, 1.5, '5', null, undefined])(
      'rejects delta %p',
      async (delta) => {
        await adjust(tokens.aManager, aProducts[0].id, delta).expect(400);
      },
    );
  });

  describe('SKU', () => {
    it('returns 409 for a duplicate SKU on create', async () => {
      const res = await as(tokens.aManager)
        .post(PRODUCTS, newProduct({ sku: 'NDL-70' }))
        .expect(409);
      expect(res.body.error).toMatchObject({
        code: 'SKU_TAKEN',
        message: 'Another product in this business has this SKU',
      });
    });

    it('returns 409 for a duplicate SKU on update', async () => {
      const res = await as(tokens.aManager)
        .patch(`${PRODUCTS}/${aProducts[1].id}`, { sku: aProducts[0].sku })
        .expect(409);
      expect(res.body.error.code).toBe('SKU_TAKEN');
    });

    it('allows the same SKU in another business, and many products without one', async () => {
      // B already uses NDL-70 (see beforeEach); A has it too.
      await as(tokens.bOwner)
        .post(PRODUCTS, newProduct({ sku: 'BSC-100' }))
        .expect(201);
      await as(tokens.aOwner).post(PRODUCTS, newProduct()).expect(201);
      await as(tokens.aOwner)
        .post(PRODUCTS, newProduct({ name: 'Second' }))
        .expect(201);
    });
  });

  describe('validation', () => {
    it.each([
      ['negative price', { pricePaisa: -1 }],
      ['fractional price', { pricePaisa: 10.5 }],
      ['missing price', { pricePaisa: undefined }],
      ['zero units per carton', { unitsPerCarton: 0 }],
      ['negative cost', { costPricePaisa: -5 }],
      ['blank name', { name: '   ' }],
      ['an unknown field', { businessId: randomUUID() }],
    ])('rejects %s', async (_label, overrides) => {
      const res = await as(tokens.aManager)
        .post(PRODUCTS, newProduct(overrides))
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('accepts a zero price and no carton size', async () => {
      const res = await as(tokens.aManager)
        .post(PRODUCTS, newProduct({ pricePaisa: 0, unitsPerCarton: null }))
        .expect(201);
      expect(res.body).toMatchObject({ pricePaisa: 0, unitsPerCarton: null });
    });

    it('on update, rejects null for required fields and clears nullable ones', async () => {
      const url = `${PRODUCTS}/${aProducts[0].id}`;
      await as(tokens.aManager).patch(url, { name: null }).expect(400);
      await as(tokens.aManager).patch(url, { pricePaisa: null }).expect(400);
      await as(tokens.aManager).patch(url, { unitsPerCarton: 0 }).expect(400);
      const res = await as(tokens.aManager)
        .patch(url, { unitsPerCarton: null, categoryId: null, sku: null })
        .expect(200);
      expect(res.body).toMatchObject({
        unitsPerCarton: null,
        categoryId: null,
        sku: null,
      });
    });
  });

  describe('products', () => {
    it('manager creates and updates a product', async () => {
      const created = await as(tokens.aManager)
        .post(
          PRODUCTS,
          newProduct({
            categoryId: aCategory.id,
            sku: 'PB-340',
            barcode: '8901234567890',
            unitsPerCarton: 12,
          }),
        )
        .expect(201);
      expect(created.body).toMatchObject({
        categoryId: aCategory.id,
        sku: 'PB-340',
        costPricePaisa: 38_000,
        isActive: true,
      });
      const updated = await as(tokens.aManager)
        .patch(`${PRODUCTS}/${created.body.id}`, { pricePaisa: 47_500 })
        .expect(200);
      expect(updated.body.pricePaisa).toBe(47_500);
      expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.body.updatedAt).getTime(),
      );
    });

    it('deactivates instead of deleting', async () => {
      const id = aProducts[0].id;
      await as(tokens.aManager)
        .patch(`${PRODUCTS}/${id}`, { isActive: false })
        .expect(200);
      expect(await productRow(id)).toMatchObject({ isActive: false });
      const inactive = await as(tokens.aSalesman)
        .get(`${PRODUCTS}?isActive=false`)
        .expect(200);
      expect(inactive.body.data.map((p: Product) => p.id)).toEqual([id]);
      await http()
        .delete(`${PRODUCTS}/${id}`)
        .auth(tokens.aOwner, { type: 'bearer' })
        .expect(404);
    });

    it.each([
      ['name, case-insensitively', 'noodles', ['NDL-70']],
      ['SKU', 'wtr', ['WTR-1L']],
      ['barcode', '8900001', ['CLA-500']],
    ])('searches by %s', async (_label, search, skus) => {
      await db
        .update(products)
        .set({ barcode: '8900001112223' })
        .where(eq(products.sku, 'CLA-500'));
      const res = await as(tokens.aSalesman)
        .get(`${PRODUCTS}?search=${encodeURIComponent(search)}`)
        .expect(200);
      expect(res.body.data.map((p: Product) => p.sku)).toEqual(skus);
    });

    it('treats LIKE wildcards in a search literally', async () => {
      await insertProduct(db, seeded.businessId, { name: '50% Off Soap' });
      const res = await as(tokens.aOwner)
        .get(`${PRODUCTS}?search=${encodeURIComponent('50%')}`)
        .expect(200);
      expect(res.body.data.map((p: Product) => p.name)).toEqual([
        '50% Off Soap',
      ]);
      const underscore = await as(tokens.aOwner)
        .get(`${PRODUCTS}?search=_`)
        .expect(200);
      expect(underscore.body.total).toBe(0);
    });

    it('filters by category and paginates', async () => {
      await insertProduct(db, seeded.businessId, { name: 'Uncategorised' });
      const inCategory = await as(tokens.aOwner)
        .get(`${PRODUCTS}?categoryId=${aCategory.id}`)
        .expect(200);
      expect(inCategory.body.total).toBe(5);

      const page = await as(tokens.aOwner)
        .get(`${PRODUCTS}?page=2&limit=4`)
        .expect(200);
      expect(page.body).toMatchObject({ page: 2, limit: 4, total: 6 });
      expect(page.body.data).toHaveLength(2);
    });
  });

  describe('categories', () => {
    it('any staff can list; only managers and owners can change', async () => {
      const res = await as(tokens.aSalesman).get(CATEGORIES).expect(200);
      expect(res.body.map((c: Category) => c.name)).toEqual([
        'Snacks & Beverages',
      ]);
      await as(tokens.aSalesman).post(CATEGORIES, { name: 'X' }).expect(403);
      await as(tokens.aSalesman)
        .patch(`${CATEGORIES}/${aCategory.id}`, { name: 'X' })
        .expect(403);
      await as(tokens.aSalesman)
        .delete(`${CATEGORIES}/${aCategory.id}`)
        .expect(403);
    });

    it('creates and renames, rejecting duplicate names', async () => {
      const created = await as(tokens.aManager)
        .post(CATEGORIES, { name: '  Dairy ' })
        .expect(201);
      expect(created.body.name).toBe('Dairy');
      const renamed = await as(tokens.aManager)
        .patch(`${CATEGORIES}/${created.body.id}`, { name: 'Dairy & Eggs' })
        .expect(200);
      expect(renamed.body.name).toBe('Dairy & Eggs');

      const dup = await as(tokens.aManager)
        .post(CATEGORIES, { name: 'Snacks & Beverages' })
        .expect(409);
      expect(dup.body.error.code).toBe('CATEGORY_NAME_TAKEN');
      await as(tokens.aManager)
        .patch(`${CATEGORIES}/${created.body.id}`, {
          name: 'Snacks & Beverages',
        })
        .expect(409);
    });

    it('deletes an unused category', async () => {
      const created = await as(tokens.aOwner)
        .post(CATEGORIES, { name: 'Empty' })
        .expect(201);
      await as(tokens.aOwner)
        .delete(`${CATEGORIES}/${created.body.id}`)
        .expect(204);
      const left = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, created.body.id));
      expect(left).toHaveLength(0);
    });

    it('refuses to delete a category any product uses, even an inactive one', async () => {
      const res = await as(tokens.aOwner)
        .delete(`${CATEGORIES}/${aCategory.id}`)
        .expect(409);
      expect(res.body.error.code).toBe('CATEGORY_IN_USE');

      const lone = await as(tokens.aOwner)
        .post(CATEGORIES, { name: 'Lone' })
        .expect(201);
      await insertProduct(db, seeded.businessId, {
        categoryId: lone.body.id,
        isActive: false,
      });
      await as(tokens.aOwner)
        .delete(`${CATEGORIES}/${lone.body.id}`)
        .expect(409);
    });
  });

  describe('tenant isolation', () => {
    it('lists show only the caller’s products and categories', async () => {
      const list = await as(tokens.aOwner).get(`${PRODUCTS}?limit=100`);
      expect(list.body.total).toBe(5);
      expect(list.text).not.toContain(b.product.id);
      const search = await as(tokens.aOwner).get(`${PRODUCTS}?search=secret`);
      expect(search.body.total).toBe(0);
      const byBCategory = await as(tokens.aOwner).get(
        `${PRODUCTS}?categoryId=${b.category.id}`,
      );
      expect(byBCategory.body.total).toBe(0);
      const categories = await as(tokens.aOwner).get(CATEGORIES);
      expect(categories.text).not.toContain(b.category.id);
    });

    it('business A cannot read, change or adjust business B’s product', async () => {
      const url = `${PRODUCTS}/${b.product.id}`;
      const responses = [
        await as(tokens.aSalesman).get(url),
        await as(tokens.aOwner).get(url),
        await as(tokens.aOwner).patch(url, { name: 'Pwned', pricePaisa: 0 }),
        await adjust(tokens.aOwner, b.product.id, -50),
        await adjust(tokens.aOwner, b.product.id, 1000),
      ];
      for (const res of responses) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
        expect(res.text).not.toContain('Secret');
      }
      expect(await productRow(b.product.id)).toMatchObject({
        name: 'B Secret Product',
        stockQuantity: 50,
      });
    });

    it('business A cannot use, rename or delete business B’s category', async () => {
      const create = await as(tokens.aOwner)
        .post(PRODUCTS, newProduct({ categoryId: b.category.id }))
        .expect(404);
      expect(create.body.error.code).toBe('CATEGORY_NOT_FOUND');
      await as(tokens.aOwner)
        .patch(`${PRODUCTS}/${aProducts[0].id}`, {
          categoryId: b.category.id,
        })
        .expect(404);
      expect((await productRow(aProducts[0].id)).categoryId).toBe(aCategory.id);

      await as(tokens.aOwner)
        .patch(`${CATEGORIES}/${b.category.id}`, { name: 'Pwned' })
        .expect(404);
      await as(tokens.aOwner)
        .delete(`${CATEGORIES}/${b.category.id}`)
        .expect(404);
      const [row] = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, b.category.id));
      expect(row.name).toBe('B Category');
    });

    it('products created by A belong to A', async () => {
      const res = await as(tokens.aOwner).post(PRODUCTS, newProduct());
      expect((await productRow(res.body.id)).businessId).toBe(
        seeded.businessId,
      );
      const bList = await as(tokens.bOwner).get(PRODUCTS);
      expect(bList.body.total).toBe(1);
    });
  });
});
