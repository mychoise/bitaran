import { randomUUID } from 'node:crypto';
import { count } from 'drizzle-orm';
import { hashPassword as hash } from '../../auth/password.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import { Database } from '../database.types.js';
import {
  businesses,
  invoiceCounters,
  productCategories,
  products,
  retailClients,
  routeClients,
  routes,
  users,
} from '../schema/index.js';

export interface SeededLogin {
  type: 'staff' | 'shop';
  role: string;
  name: string;
  email: string;
  password: string;
}

export interface SeedResult {
  businessId: string;
  routeId: string;
  logins: SeededLogin[];
}

const PASSWORDS = {
  owner: 'Owner@12345',
  manager: 'Manager@12345',
  salesman: 'Salesman@12345',
  shop: 'Shop@12345',
} as const;

const STAFF = [
  {
    role: 'owner',
    fullName: 'Asha Shrestha',
    email: 'owner@asva.test',
    phone: '9801000001',
  },
  {
    role: 'manager',
    fullName: 'Bikash Thapa',
    email: 'manager@asva.test',
    phone: '9801000002',
  },
  {
    role: 'salesman',
    fullName: 'Suman Gurung',
    email: 'salesman1@asva.test',
    phone: '9801000003',
  },
  {
    role: 'salesman',
    fullName: 'Nabin Karki',
    email: 'salesman2@asva.test',
    phone: '9801000004',
  },
] as const;

// In route order.
const SHOPS = [
  {
    name: 'Kalimati Kirana Pasal',
    ownerName: 'Hari Maharjan',
    email: 'shop1@asva.test',
    pan: '301000001',
    lat: 27.6985,
    lng: 85.2961,
  },
  {
    name: 'Balkhu General Store',
    ownerName: 'Sita Tamang',
    email: 'shop2@asva.test',
    pan: '301000002',
    lat: 27.6849,
    lng: 85.2981,
  },
  {
    name: 'Kuleshwor Suppliers',
    ownerName: 'Gopal Basnet',
    email: 'shop3@asva.test',
    pan: '301000003',
    lat: 27.6913,
    lng: 85.3002,
  },
] as const;

// Prices in paisa; stock in base units (pieces).
const PRODUCTS = [
  {
    name: 'Instant Noodles 70g',
    sku: 'NDL-70',
    unitsPerCarton: 30,
    price: 2000,
    carton: 57000,
    mrp: 2500,
    cost: 1700,
    stock: 3000,
  },
  {
    name: 'Glucose Biscuit 100g',
    sku: 'BSC-100',
    unitsPerCarton: 48,
    price: 1500,
    carton: 69000,
    mrp: 2000,
    cost: 1250,
    stock: 4800,
  },
  {
    name: 'Mineral Water 1L',
    sku: 'WTR-1L',
    unitsPerCarton: 12,
    price: 2500,
    carton: 28000,
    mrp: 3000,
    cost: 1800,
    stock: 1200,
  },
  {
    name: 'Cola 500ml',
    sku: 'CLA-500',
    unitsPerCarton: 24,
    price: 5500,
    carton: 126000,
    mrp: 6500,
    cost: 4600,
    stock: 960,
  },
  {
    name: 'Potato Chips 50g',
    sku: 'CHP-50',
    unitsPerCarton: 40,
    price: 4500,
    carton: 172000,
    mrp: 5000,
    cost: 3600,
    stock: 2000,
  },
] as const;

/** Seeds one demo business. Refuses to run unless the database is empty. */
export async function seed(db: Database): Promise<SeedResult> {
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(businesses);
  if (existing > 0) {
    throw new Error('Seed refused: the database already contains businesses.');
  }

  const hashes = {
    owner: await hash(PASSWORDS.owner),
    manager: await hash(PASSWORDS.manager),
    salesman: await hash(PASSWORDS.salesman),
    shop: await hash(PASSWORDS.shop),
  };
  const now = new Date();

  return withTransaction(db, async (tx) => {
    const businessId = randomUUID();
    await tx.insert(businesses).values({
      id: businessId,
      name: 'Asva Traders',
      panNumber: '609876543',
      phone: '014270000',
      email: 'info@asva.test',
      address: 'Kalimati, Kathmandu',
      city: 'Kathmandu',
      createdAt: now,
    });
    await tx.insert(invoiceCounters).values({ businessId, lastNumber: 0 });

    const staffRows = STAFF.map((s) => ({
      id: randomUUID(),
      businessId,
      role: s.role,
      fullName: s.fullName,
      phone: s.phone,
      email: s.email.toLowerCase(),
      passwordHash: hashes[s.role],
      createdAt: now,
    }));
    await tx.insert(users).values(staffRows);
    const manager = staffRows.find((u) => u.role === 'manager')!;

    const routeId = randomUUID();
    await tx.insert(routes).values({
      id: routeId,
      businessId,
      name: 'Kalimati - Balkhu',
      description: 'Kalimati market to Balkhu and Kuleshwor',
      createdBy: manager.id,
      createdAt: now,
    });

    const shopRows = SHOPS.map((s) => ({
      id: randomUUID(),
      businessId,
      name: s.name,
      ownerName: s.ownerName,
      address: 'Kathmandu',
      panNumber: s.pan,
      lat: s.lat,
      lng: s.lng,
      email: s.email.toLowerCase(),
      passwordHash: hashes.shop,
      creditLimitPaisa: 5_000_000,
      createdAt: now,
    }));
    await tx.insert(retailClients).values(shopRows);
    await tx
      .insert(routeClients)
      .values(
        shopRows.map((s, i) => ({ routeId, clientId: s.id, sequence: i })),
      );

    const categoryId = randomUUID();
    await tx.insert(productCategories).values({
      id: categoryId,
      businessId,
      name: 'Snacks & Beverages',
      createdAt: now,
    });
    await tx.insert(products).values(
      PRODUCTS.map((p) => ({
        id: randomUUID(),
        businessId,
        categoryId,
        name: p.name,
        sku: p.sku,
        unit: 'piece',
        unitsPerCarton: p.unitsPerCarton,
        pricePaisa: p.price,
        cartonPricePaisa: p.carton,
        mrpPaisa: p.mrp,
        costPricePaisa: p.cost,
        stockQuantity: p.stock,
        lowStockAlert: p.unitsPerCarton * 5,
        createdAt: now,
        updatedAt: now,
      })),
    );

    const logins: SeededLogin[] = [
      ...staffRows.map((u) => ({
        type: 'staff' as const,
        role: u.role,
        name: u.fullName,
        email: u.email,
        password: PASSWORDS[u.role],
      })),
      ...shopRows.map((s) => ({
        type: 'shop' as const,
        role: 'shop',
        name: s.name,
        email: s.email,
        password: PASSWORDS.shop,
      })),
    ];
    return { businessId, routeId, logins };
  });
}
