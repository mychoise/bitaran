import * as argon2 from 'argon2';
import { asc, count, eq } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { Database } from '../src/database/database.types.js';
import {
  businesses,
  invoiceCounters,
  productCategories,
  products,
  retailClients,
  routeClients,
  routes,
  users,
} from '../src/database/schema/index.js';
import { seed } from '../src/database/seed/seed.js';
import { createTestDb, truncateAll } from './utils/test-db.js';

describe('seed', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });
  beforeEach(() => truncateAll(db));
  afterAll(() => close());

  const countOf = async (table: PgTable) =>
    (await db.select({ n: count() }).from(table))[0].n;

  it('seeds one complete business on an empty database', async () => {
    const result = await seed(db);

    expect(await countOf(businesses)).toBe(1);
    const [business] = await db.select().from(businesses);
    expect(business.panNumber).toMatch(/^[0-9]{9}$/);
    expect(await db.select().from(invoiceCounters)).toEqual([
      { businessId: result.businessId, lastNumber: 0 },
    ]);

    const staff = await db.select().from(users);
    expect(staff.map((u) => u.role).sort()).toEqual([
      'manager',
      'owner',
      'salesman',
      'salesman',
    ]);

    expect(await countOf(retailClients)).toBe(3);
    expect(await countOf(routes)).toBe(1);
    const stops = await db
      .select()
      .from(routeClients)
      .where(eq(routeClients.routeId, result.routeId))
      .orderBy(asc(routeClients.sequence));
    expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);

    expect(await countOf(productCategories)).toBe(1);
    const items = await db.select().from(products);
    expect(items).toHaveLength(5);
    for (const p of items) {
      expect(p.costPricePaisa).toEqual(expect.any(Number));
      expect(p.cartonPricePaisa).toEqual(expect.any(Number));
      expect(p.stockQuantity).toBeGreaterThan(0);
      expect(Number.isInteger(p.pricePaisa)).toBe(true);
    }
  });

  it('returns working, lowercased logins hashed with argon2id', async () => {
    const { logins } = await seed(db);
    expect(logins).toHaveLength(7);

    for (const login of logins) {
      expect(login.email).toBe(login.email.toLowerCase());
      const table = login.type === 'staff' ? users : retailClients;
      const [row] = await db
        .select()
        .from(table)
        .where(eq(table.email, login.email));
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await argon2.verify(row.passwordHash, login.password)).toBe(true);
    }
  });

  it('refuses to run on a non-empty database', async () => {
    await seed(db);
    await expect(seed(db)).rejects.toThrow(/already contains/);
    expect(await countOf(businesses)).toBe(1);
  });
});
