import { Database } from '../src/database/database.types.js';
import { expectPgError, PG } from './utils/pg-error.js';
import {
  insertBusiness,
  insertProduct,
  insertSale,
  insertSalesContext,
  insertUser,
} from './utils/factories.js';
import { createTestDb, TABLE_COUNT, truncateAll } from './utils/test-db.js';

describe('Database constraints', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  beforeEach(() => truncateAll(db));
  afterAll(() => close());

  it('test cleanup truncates all 20 tables', () => {
    expect(TABLE_COUNT).toBe(20);
  });

  describe('businesses.pan_number', () => {
    it('accepts a 9-digit PAN', async () => {
      await expect(
        insertBusiness(db, { panNumber: '601234567' }),
      ).resolves.toBeDefined();
    });

    it.each(['12345678', '1234567890', '60123456A', '601 234 567', ''])(
      'rejects PAN %p',
      async (panNumber) => {
        await expectPgError(
          insertBusiness(db, { panNumber }),
          PG.CHECK_VIOLATION,
          'businesses_pan_number_format',
        );
      },
    );

    it('rejects a duplicate PAN', async () => {
      await insertBusiness(db, { panNumber: '601234567' });
      await expectPgError(
        insertBusiness(db, { panNumber: '601234567' }),
        PG.UNIQUE_VIOLATION,
        'businesses_pan_number_unique',
      );
    });
  });

  describe('one owner per business', () => {
    it('rejects a second owner in the same business', async () => {
      const business = await insertBusiness(db);
      await insertUser(db, business.id, { role: 'owner' });
      await expectPgError(
        insertUser(db, business.id, { role: 'owner' }),
        PG.UNIQUE_VIOLATION,
        'idx_users_one_owner_per_business',
      );
    });

    it('allows one owner in each of two businesses, and many managers', async () => {
      const a = await insertBusiness(db);
      const b = await insertBusiness(db);
      await insertUser(db, a.id, { role: 'owner' });
      await insertUser(db, b.id, { role: 'owner' });
      await insertUser(db, a.id, { role: 'manager' });
      await expect(
        insertUser(db, a.id, { role: 'manager' }),
      ).resolves.toBeDefined();
    });
  });

  describe('product prices', () => {
    it('accepts a zero price', async () => {
      const business = await insertBusiness(db);
      await expect(
        insertProduct(db, business.id, { pricePaisa: 0 }),
      ).resolves.toBeDefined();
    });

    it.each([
      ['pricePaisa', 'products_price_paisa_nonneg'],
      ['cartonPricePaisa', 'products_carton_price_paisa_nonneg'],
      ['mrpPaisa', 'products_mrp_paisa_nonneg'],
      ['costPricePaisa', 'products_cost_price_paisa_nonneg'],
    ] as const)('rejects a negative %s', async (field, constraint) => {
      const business = await insertBusiness(db);
      await expectPgError(
        insertProduct(db, business.id, { [field]: -1 }),
        PG.CHECK_VIOLATION,
        constraint,
      );
    });

    it('rejects negative stock', async () => {
      const business = await insertBusiness(db);
      await expectPgError(
        insertProduct(db, business.id, { stockQuantity: -1 }),
        PG.CHECK_VIOLATION,
        'products_stock_quantity_nonneg',
      );
    });
  });

  describe('sales.invoice_number', () => {
    it('rejects a duplicate invoice number in the same business', async () => {
      const ctx = await insertSalesContext(db);
      await insertSale(db, ctx, 1);
      await expectPgError(
        insertSale(db, ctx, 1),
        PG.UNIQUE_VIOLATION,
        'idx_sales_business_invoice',
      );
    });

    it('allows the same invoice number in different businesses', async () => {
      await insertSale(db, await insertSalesContext(db), 1);
      await expect(
        insertSale(db, await insertSalesContext(db), 1),
      ).resolves.toBeDefined();
    });
  });
});
