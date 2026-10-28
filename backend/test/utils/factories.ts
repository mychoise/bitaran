import { randomUUID } from 'node:crypto';
import { nepalToday } from '../../src/common/utils/date.util.js';
import { Database } from '../../src/database/database.types.js';
import {
  businesses,
  dayPlans,
  invoiceCounters,
  products,
  retailClients,
  routes,
  sales,
  users,
} from '../../src/database/schema/index.js';

// Minimal row builders for tests. Every id is random, so rows never collide.
// Hashes default to a placeholder that matches no password; pass a real
// `passwordHash` for a row that must be able to log in.

const uniquePan = () =>
  String(Math.floor(100_000_000 + Math.random() * 899_999_999));

export async function insertBusiness(
  db: Database,
  overrides: Partial<typeof businesses.$inferInsert> = {},
) {
  const [row] = await db
    .insert(businesses)
    .values({
      id: randomUUID(),
      name: 'Test Traders',
      panNumber: uniquePan(),
      phone: '9800000000',
      address: 'Kathmandu',
      createdAt: new Date(),
      ...overrides,
    })
    .returning();
  // Every business has an invoice counter, as the seed creates one.
  await db.insert(invoiceCounters).values({ businessId: row.id });
  return row;
}

export async function insertUser(
  db: Database,
  businessId: string,
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const id = randomUUID();
  const [row] = await db
    .insert(users)
    .values({
      id,
      businessId,
      role: 'salesman',
      fullName: 'Test User',
      email: `${id}@test.local`,
      passwordHash: 'x',
      createdAt: new Date(),
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertProduct(
  db: Database,
  businessId: string,
  overrides: Partial<typeof products.$inferInsert> = {},
) {
  const now = new Date();
  const [row] = await db
    .insert(products)
    .values({
      id: randomUUID(),
      businessId,
      name: 'Test Product',
      pricePaisa: 1000,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return row;
}

/** A business with a manager, salesman, route, shop and day plan: enough to insert sales. */
export async function insertSalesContext(db: Database) {
  const business = await insertBusiness(db);
  const manager = await insertUser(db, business.id, { role: 'manager' });
  const salesman = await insertUser(db, business.id, { role: 'salesman' });
  const [route] = await db
    .insert(routes)
    .values({
      id: randomUUID(),
      businessId: business.id,
      name: 'Route',
      createdAt: new Date(),
    })
    .returning();
  const clientId = randomUUID();
  const [client] = await db
    .insert(retailClients)
    .values({
      id: clientId,
      businessId: business.id,
      name: 'Shop',
      email: `${clientId}@test.local`,
      passwordHash: 'x',
      createdAt: new Date(),
    })
    .returning();
  const [dayPlan] = await db
    .insert(dayPlans)
    .values({
      id: randomUUID(),
      businessId: business.id,
      salesmanId: salesman.id,
      routeId: route.id,
      planDate: nepalToday(),
      assignedBy: manager.id,
      createdAt: new Date(),
    })
    .returning();
  return { business, manager, salesman, route, client, dayPlan };
}

export async function insertSale(
  db: Database,
  ctx: Awaited<ReturnType<typeof insertSalesContext>>,
  invoiceNumber: number,
) {
  const [row] = await db
    .insert(sales)
    .values({
      id: randomUUID(),
      businessId: ctx.business.id,
      clientId: ctx.client.id,
      salesmanId: ctx.salesman.id,
      dayPlanId: ctx.dayPlan.id,
      invoiceNumber,
      saleDate: nepalToday(),
      totalPaisa: 10_000,
      createdAt: new Date(),
    })
    .returning();
  return row;
}
