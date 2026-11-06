import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { hashPassword as hash } from '../../auth/password.js';
import { nepalToday } from '../../common/utils/date.util.js';
import { distanceInMetres } from '../../common/utils/geo.util.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import { newStorageKey } from '../../storage/storage-key.js';
import type { StorageCategory } from '../../storage/storage-key.js';
import { Database } from '../database.types.js';
import {
  dayPlanStock,
  dayPlans,
  expenses,
  invoiceCounters,
  paymentImages,
  payments,
  products,
  retailClients,
  routeClients,
  routes,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  stockWriteOffs,
  users,
  visitPhotos,
  visits,
} from '../schema/index.js';
import type { SeedResult, SeededLogin } from './seed.js';

/**
 * A week of demo activity on top of seed(): a second route with three more
 * shops, day plans for both salesmen (reconciled, closed, one in progress
 * today, planned), sales, cash/cheque/online payments (pending, confirmed,
 * bounced), returns, write-offs, expenses and visit photos. Everything is
 * written the way the services would leave it: warehouse stock moves with
 * issue, count and restock, invoice numbers run in order, balances follow
 * from the rows. Only for development and demos; tests use seed() alone.
 */

export interface ActivityOptions {
  /** Saves a generated image under a storage key. Without it, no records with images are made. */
  storeImage?: (key: string, jpeg: Buffer) => Promise<void>;
}

export interface ActivityResult {
  logins: SeededLogin[];
  counts: Record<string, number>;
}

const SHOP_PASSWORD = 'Shop@12345';

const MORE_SHOPS = [
  {
    name: 'Kalanki Mart',
    ownerName: 'Ram Adhikari',
    email: 'shop4@asva.test',
    pan: '301000004',
    lat: 27.6931,
    lng: 85.2817,
    address: 'Kalanki, Kathmandu',
  },
  {
    name: 'Sitapaila Suppliers',
    ownerName: 'Maya Lama',
    email: 'shop5@asva.test',
    pan: '301000005',
    lat: 27.7086,
    lng: 85.2826,
    address: 'Sitapaila, Kathmandu',
  },
  {
    name: 'Swayambhu Traders',
    ownerName: 'Kiran Shakya',
    email: 'shop6@asva.test',
    pan: '301000006',
    lat: 27.7149,
    lng: 85.2904,
    address: 'Swayambhu, Kathmandu',
  },
] as const;

/** Credit limit and opening balance per shop, in route order (route 1 then 2). */
const TERMS = [
  { limit: 5_000_000, opening: 0 },
  { limit: 3_000_000, opening: 1_200_000 },
  { limit: 8_000_000, opening: 0 },
  { limit: 2_000_000, opening: 0 },
  { limit: 2_500_000, opening: 450_000 },
  { limit: 1_000_000, opening: 0 },
];

// ---- small helpers ---------------------------------------------------------------------------

/** A repeatable random sequence (mulberry32), so every seed run looks the same. */
function random(seedValue: number) {
  let a = seedValue;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** A Nepal wall-clock time on a Nepal date, as an instant. */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:45`);
const hhmm = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** A small labelled JPEG: a coloured card with a few lines of text. Each one is different. */
async function picture(lines: string[], hue: number): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = lines
    .map(
      (l, i) =>
        `<text x="32" y="${90 + i * 46}" font-family="sans-serif" font-size="${i === 0 ? 34 : 26}" fill="#1d1b19">${esc(l)}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="hsl(${hue},45%,82%)"/><rect x="16" y="16" width="608" height="448" fill="none" stroke="#1d1b19" stroke-width="3"/>${text}<text x="32" y="440" font-family="sans-serif" font-size="20" fill="#5c5650">Demo image</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

// ---- the seed ----------------------------------------------------------------------------------

export async function seedActivity(
  db: Database,
  base: SeedResult,
  opts: ActivityOptions = {},
): Promise<ActivityResult> {
  const rand = random(20261105);
  const between = (lo: number, hi: number) =>
    lo + Math.floor(rand() * (hi - lo + 1));
  const today = nepalToday();
  const businessId = base.businessId;
  const shopHash = await hash(SHOP_PASSWORD);

  // Image files are written as records need them. A failed seed leaves those files behind;
  // they are never served without a row that points at them.
  const images: { key: string; hash: string }[] = [];
  const image = async (
    category: StorageCategory,
    lines: string[],
    hue: number,
  ) => {
    if (!opts.storeImage) return null;
    const buf = await picture(lines, hue);
    const key = newStorageKey(businessId, category);
    await opts.storeImage(key, buf);
    const img = { key, hash: sha256(buf) };
    images.push(img);
    return img;
  };

  const staff = await db
    .select()
    .from(users)
    .where(eq(users.businessId, businessId));
  const owner = staff.find((u) => u.role === 'owner')!;
  const manager = staff.find((u) => u.role === 'manager')!;
  const [s1, s2] = staff
    .filter((u) => u.role === 'salesman')
    .sort((a, b) => a.email.localeCompare(b.email));
  const catalog = (
    await db.select().from(products).where(eq(products.businessId, businessId))
  ).sort((a, b) => a.name.localeCompare(b.name));
  const warehouse = new Map(catalog.map((p) => [p.id, p.stockQuantity]));
  const firstShops = await db
    .select({
      id: retailClients.id,
      name: retailClients.name,
      lat: retailClients.lat,
      lng: retailClients.lng,
      sequence: routeClients.sequence,
    })
    .from(retailClients)
    .innerJoin(routeClients, eq(routeClients.clientId, retailClients.id))
    .where(eq(routeClients.routeId, base.routeId));
  firstShops.sort((a, b) => a.sequence - b.sequence);

  type Img = Awaited<ReturnType<typeof image>>;
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  return withTransaction(db, async (tx) => {
    // ---- a second route with three more shops
    const route2 = randomUUID();
    await tx.insert(routes).values({
      id: route2,
      businessId,
      name: 'Kalanki - Swayambhu',
      description: 'Kalanki to Sitapaila and Swayambhu',
      createdBy: manager.id,
      createdAt: at(addDays(today, -30), '10:00'),
    });
    const newShops = MORE_SHOPS.map((s) => ({
      id: randomUUID(),
      businessId,
      name: s.name,
      ownerName: s.ownerName,
      address: s.address,
      panNumber: s.pan,
      lat: s.lat,
      lng: s.lng,
      email: s.email,
      passwordHash: shopHash,
      creditLimitPaisa: 0,
      createdAt: at(addDays(today, -30), '10:00'),
    }));
    await tx.insert(retailClients).values(newShops);
    await tx.insert(routeClients).values(
      newShops.map((s, i) => ({
        routeId: route2,
        clientId: s.id,
        sequence: i,
      })),
    );
    const allShops = [
      ...firstShops.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      })),
      ...newShops.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      })),
    ];
    for (const [i, shop] of allShops.entries()) {
      await tx
        .update(retailClients)
        .set({
          creditLimitPaisa: TERMS[i].limit,
          openingBalancePaisa: TERMS[i].opening,
          phone: `98010200${String(i + 1).padStart(2, '0')}`,
        })
        .where(eq(retailClients.id, shop.id));
    }
    const routeShops = {
      [base.routeId]: allShops.slice(0, 3),
      [route2]: allShops.slice(3),
    };

    let invoice = 0;
    const plansOut: {
      id: string;
      salesmanId: string;
      date: string;
      status: string;
    }[] = [];

    // Which plans: both salesmen, last six days, today and tomorrow.
    type Spec = {
      day: number;
      salesman: typeof s1;
      routeId: string;
      status: 'planned' | 'in_progress' | 'closed' | 'reconciled';
    };
    const specs: Spec[] = [];
    for (let day = -6; day <= -1; day++) {
      specs.push({
        day,
        salesman: s1,
        routeId: day % 2 ? base.routeId : route2,
        status: day === -1 ? 'closed' : 'reconciled',
      });
      specs.push({
        day,
        salesman: s2,
        routeId: day % 2 ? route2 : base.routeId,
        status: 'reconciled',
      });
    }
    specs.push({
      day: 0,
      salesman: s1,
      routeId: base.routeId,
      status: 'in_progress',
    });
    specs.push({ day: 0, salesman: s2, routeId: route2, status: 'planned' });
    specs.push({ day: 1, salesman: s1, routeId: route2, status: 'planned' });

    for (const spec of specs) {
      const date = addDays(today, spec.day);
      const planId = randomUUID();
      const started = spec.status !== 'planned';
      const closed = spec.status === 'closed' || spec.status === 'reconciled';
      await tx.insert(dayPlans).values({
        id: planId,
        businessId,
        salesmanId: spec.salesman.id,
        routeId: spec.routeId,
        planDate: date,
        assignedBy: manager.id,
        status: 'planned',
        createdAt: at(addDays(date, -1), '17:30'),
      });
      plansOut.push({
        id: planId,
        salesmanId: spec.salesman.id,
        date,
        status: spec.status,
      });
      bump('day plans');

      // Issue: four products, one or two cartons' worth each, in pieces.
      const carried = [...catalog].sort(() => rand() - 0.5).slice(0, 4);
      const van = new Map<string, number>();
      const lines = carried.map((p) => {
        const qty = (p.unitsPerCarton ?? 12) * between(1, 2);
        van.set(p.id, qty);
        warehouse.set(p.id, warehouse.get(p.id)! - qty);
        return {
          id: randomUUID(),
          dayPlanId: planId,
          productId: p.id,
          unit: 'base',
          quantityIssued: qty,
        };
      });
      await tx.insert(dayPlanStock).values(lines);

      const stops = routeShops[spec.routeId];
      const visitRows = stops.map((shop, sequence) => ({
        id: randomUUID(),
        dayPlanId: planId,
        clientId: shop.id,
        sequence,
        status: 'planned' as const,
      }));
      await tx.insert(visits).values(visitRows);
      if (!started) continue;

      let cash = 0;
      for (const [i, v] of visitRows.entries()) {
        const shop = stops[i];
        if (spec.status === 'in_progress' && i >= 2) break; // the rest of today is still ahead
        const visitedAt = at(date, hhmm(9 + i * 2, between(5, 50)));
        if (closed && i === 2 && spec.day === -5) {
          await tx
            .update(visits)
            .set({
              status: 'skipped',
              visitedAt,
              note: 'Shop closed for a family function',
            })
            .where(eq(visits.id, v.id));
          bump('visits skipped');
          continue;
        }
        await tx
          .update(visits)
          .set({ status: 'visited', visitedAt, lat: shop.lat, lng: shop.lng })
          .where(eq(visits.id, v.id));

        // A sale of two or three of what the van carries.
        const items = carried
          .filter((p) => (van.get(p.id) ?? 0) > 0)
          .sort(() => rand() - 0.5)
          .slice(0, between(2, 3))
          .map((p) => {
            const qty = Math.min(van.get(p.id)!, between(6, 24));
            return { p, qty };
          })
          .filter((x) => x.qty > 0);
        if (items.length) {
          const saleId = randomUUID();
          const total = items.reduce((n, x) => n + x.qty * x.p.pricePaisa, 0);
          const cancelled =
            spec.day === -4 && i === 0 && spec.salesman.id === s1.id;
          if (!cancelled)
            for (const x of items) van.set(x.p.id, van.get(x.p.id)! - x.qty);
          invoice += 1;
          await tx.insert(sales).values({
            id: saleId,
            businessId,
            clientId: shop.id,
            salesmanId: spec.salesman.id,
            dayPlanId: planId,
            visitId: v.id,
            invoiceNumber: invoice,
            saleDate: date,
            dueDate: addDays(date, spec.day <= -5 ? 3 : 7),
            totalPaisa: total,
            status: cancelled ? 'cancelled' : 'confirmed',
            cancelReason: cancelled ? 'Entered twice by mistake' : null,
            createdAt: visitedAt,
          });
          await tx.insert(saleItems).values(
            items.map((x) => ({
              id: randomUUID(),
              saleId,
              productId: x.p.id,
              productName: x.p.name,
              unit: 'base',
              quantity: x.qty,
              unitPricePaisa: x.p.pricePaisa,
              lineTotalPaisa: x.qty * x.p.pricePaisa,
            })),
          );
          bump(cancelled ? 'sales cancelled' : 'sales');

          // Cash at the counter: all of it, part of it, or none (on credit).
          const r = rand();
          const paid = cancelled
            ? 0
            : r < 0.4
              ? total
              : r < 0.7
                ? Math.floor(total / 2 / 10_000) * 10_000
                : 0;
          if (paid > 0) {
            await tx.insert(payments).values({
              id: randomUUID(),
              businessId,
              clientId: shop.id,
              saleId,
              dayPlanId: planId,
              collectedBy: spec.salesman.id,
              method: 'cash',
              status: 'confirmed',
              amountPaisa: paid,
              receivedAt: visitedAt,
              createdAt: visitedAt,
            });
            cash += paid;
            bump('cash payments');
          }
        }

        // A few cheques and online payments towards the balance.
        const special = `${spec.day}:${spec.salesman.id === s1.id ? 1 : 2}:${i}`;
        const other: Record<
          string,
          {
            method: 'cheque' | 'online';
            status: 'pending' | 'confirmed' | 'bounced';
            amount: number;
          }
        > = {
          '-6:1:1': { method: 'cheque', status: 'confirmed', amount: 800_000 },
          '-5:2:0': { method: 'cheque', status: 'bounced', amount: 500_000 },
          '-3:1:0': { method: 'online', status: 'confirmed', amount: 300_000 },
          '-1:1:1': { method: 'cheque', status: 'pending', amount: 600_000 },
          '-1:2:2': { method: 'online', status: 'pending', amount: 250_000 },
          '0:1:0': { method: 'cheque', status: 'pending', amount: 400_000 },
        };
        const o = other[special];
        if (o) {
          const id = randomUUID();
          const when = new Date(visitedAt.getTime() + 15 * 60_000);
          const img: Img = await image(
            'payment-images',
            o.method === 'cheque'
              ? [
                  'Cheque',
                  `Nabil Bank · No. ${between(100000, 999999)}`,
                  shop.name,
                  `Rs ${(o.amount / 100).toLocaleString('en-IN')}`,
                ]
              : [
                  'Online payment',
                  `Ref FT${between(1000000, 9999999)}`,
                  shop.name,
                ],
            o.method === 'cheque' ? 200 : 160,
          );
          if (img) {
            await tx.insert(payments).values({
              id,
              businessId,
              clientId: shop.id,
              dayPlanId: planId,
              collectedBy: spec.salesman.id,
              method: o.method,
              status: o.status,
              amountPaisa: o.amount,
              receivedAt: when,
              chequeNumber:
                o.method === 'cheque' ? String(between(100000, 999999)) : null,
              chequeBank: o.method === 'cheque' ? 'Nabil Bank' : null,
              chequeDate: o.method === 'cheque' ? date : null,
              referenceNo:
                o.method === 'online' ? `FT${between(1000000, 9999999)}` : null,
              note:
                o.status === 'bounced'
                  ? 'Returned by the bank: insufficient funds'
                  : null,
              createdAt: when,
            });
            await tx.insert(paymentImages).values({
              id: randomUUID(),
              paymentId: id,
              kind:
                o.method === 'cheque' ? 'cheque_front' : 'online_screenshot',
              imageKey: img.key,
              imageHash: img.hash,
              uploadedBy: spec.salesman.id,
              uploadedAt: when,
            });
            bump(`${o.method} payments (${o.status})`);
          }
        }

        // A photo at the shop. A few are flagged for the manager to look at.
        const mine = spec.salesman.id === s1.id;
        const flag = !mine
          ? null
          : spec.day === -4 && i === 1
            ? 'too_far'
            : spec.day === -2 && i === 0
              ? 'no_exif'
              : spec.day === -3 && i === 2
                ? 'exif_old'
                : null;
        const lat =
          shop.lat! + (flag === 'too_far' ? 0.012 : (rand() - 0.5) * 0.0004);
        const lng = shop.lng! + (rand() - 0.5) * 0.0004;
        const img: Img = await image(
          'visit-photos',
          [shop.name, `${date} ${hhmm(9 + i * 2, 10)}`, spec.salesman.fullName],
          30 + i * 40,
        );
        if (img) {
          await tx.insert(visitPhotos).values({
            id: randomUUID(),
            visitId: v.id,
            imageKey: img.key,
            takenAt: visitedAt,
            lat,
            lng,
            note:
              i === 0 && spec.day === -6
                ? 'Met the owner; asked for more noodles next week'
                : null,
            exifTakenAt:
              flag === 'no_exif'
                ? null
                : flag === 'exif_old'
                  ? at(addDays(date, -3), '11:00')
                  : visitedAt,
            imageHash: img.hash,
            distanceFromShopM: Math.round(
              distanceInMetres(
                { lat, lng },
                { lat: shop.lat!, lng: shop.lng! },
              ),
            ),
            flagReason: flag,
          });
          bump('visit photos');
        }
      }

      // A damaged pack written off from the van.
      if (spec.day === -3 && spec.salesman.id === s2.id) {
        const p = carried.find((x) => (van.get(x.id) ?? 0) >= 2)!;
        van.set(p.id, van.get(p.id)! - 2);
        await tx.insert(stockWriteOffs).values({
          id: randomUUID(),
          businessId,
          productId: p.id,
          unit: 'base',
          quantity: 2,
          reason: 'damaged',
          costValuePaisa: 2 * (p.costPricePaisa ?? 0),
          writeOffDate: date,
          dayPlanId: planId,
          recordedBy: manager.id,
          note: 'Crushed in the van',
          createdAt: at(date, '18:30'),
        });
        bump('write-offs');
      }

      if (spec.status === 'in_progress') {
        await tx
          .update(dayPlans)
          .set({ status: 'in_progress', startedAt: at(date, '09:00') })
          .where(eq(dayPlans.id, planId));
        continue;
      }

      // Closing: what comes back, and the cash. One day is a piece short, one is Rs 100 short.
      const shortPiece = spec.day === -2 && spec.salesman.id === s1.id;
      const shortCash = spec.day === -4 && spec.salesman.id === s2.id;
      const shortLine = shortPiece
        ? lines.find((l) => (van.get(l.productId) ?? 0) > 0)
        : undefined;
      for (const l of lines) {
        const back = Math.max(
          0,
          (van.get(l.productId) ?? 0) - (l === shortLine ? 1 : 0),
        );
        await tx
          .update(dayPlanStock)
          .set({
            quantityReturned: back,
            ...(spec.status === 'reconciled' ? { quantityCounted: back } : {}),
          })
          .where(eq(dayPlanStock.id, l.id));
        if (spec.status === 'reconciled')
          warehouse.set(l.productId, warehouse.get(l.productId)! + back);
      }
      const handed = Math.max(0, cash - (shortCash ? 10_000 : 0));
      await tx
        .update(dayPlans)
        .set({
          status: spec.status,
          startedAt: at(date, '09:00'),
          closedAt: at(date, '18:00'),
          cashHandedOverPaisa: handed,
          ...(spec.status === 'reconciled'
            ? {
                reconciledBy: manager.id,
                reconciledAt: at(date, '19:00'),
                note: shortPiece
                  ? 'Reconciliation: one piece missing; the salesman will pay for it.'
                  : shortCash
                    ? 'Reconciliation: Rs 100 short in cash; noted.'
                    : null,
              }
            : {}),
        })
        .where(eq(dayPlans.id, planId));
    }

    // ---- returns: one on a visit (damaged, not restocked), one at the office (restocked)
    const [shop1, shop2] = allShops;
    const biscuit = catalog.find((p) => p.sku === 'BSC-100') ?? catalog[0];
    const noodles = catalog.find((p) => p.sku === 'NDL-70') ?? catalog[1];
    const r1 = randomUUID();
    await tx.insert(saleReturns).values({
      id: r1,
      businessId,
      clientId: shop1.id,
      receivedBy: s1.id,
      returnDate: addDays(today, -2),
      totalPaisa: 3 * biscuit.pricePaisa,
      note: 'Packs torn',
      createdAt: at(addDays(today, -2), '10:20'),
    });
    await tx.insert(saleReturnItems).values({
      id: randomUUID(),
      saleReturnId: r1,
      productId: biscuit.id,
      productName: biscuit.name,
      unit: 'base',
      quantity: 3,
      unitPricePaisa: biscuit.pricePaisa,
      lineTotalPaisa: 3 * biscuit.pricePaisa,
      reason: 'damaged',
      restocked: false,
    });
    const r2 = randomUUID();
    await tx.insert(saleReturns).values({
      id: r2,
      businessId,
      clientId: shop2.id,
      receivedBy: manager.id,
      returnDate: addDays(today, -1),
      totalPaisa: 5 * noodles.pricePaisa,
      note: 'Ordered too many',
      createdAt: at(addDays(today, -1), '14:00'),
    });
    await tx.insert(saleReturnItems).values({
      id: randomUUID(),
      saleReturnId: r2,
      productId: noodles.id,
      productName: noodles.name,
      unit: 'base',
      quantity: 5,
      unitPricePaisa: noodles.pricePaisa,
      lineTotalPaisa: 5 * noodles.pricePaisa,
      reason: 'other',
      restocked: true,
    });
    warehouse.set(noodles.id, warehouse.get(noodles.id)! + 5);
    bump('returns', 2);

    // ---- a warehouse write-off (expired)
    const water = catalog.find((p) => p.sku === 'WTR-1L') ?? catalog[2];
    await tx.insert(stockWriteOffs).values({
      id: randomUUID(),
      businessId,
      productId: water.id,
      unit: 'base',
      quantity: 12,
      reason: 'expired',
      costValuePaisa: 12 * (water.costPricePaisa ?? 0),
      writeOffDate: addDays(today, -2),
      recordedBy: manager.id,
      note: 'Past its date',
      createdAt: at(addDays(today, -2), '11:00'),
    });
    warehouse.set(water.id, warehouse.get(water.id)! - 12);
    bump('write-offs');

    // ---- expenses: salary for last month, fuel and khaja on worked days, a little misc
    const lastMonth = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    const exp: (typeof expenses.$inferInsert)[] = [
      {
        id: randomUUID(),
        businessId,
        type: 'salary',
        amountPaisa: 1_800_000,
        expenseDate: addDays(today, -5),
        userId: s1.id,
        forMonth: lastMonth,
        description: 'Monthly salary',
        recordedBy: owner.id,
        createdAt: at(addDays(today, -5), '10:00'),
      },
      {
        id: randomUUID(),
        businessId,
        type: 'salary',
        amountPaisa: 1_600_000,
        expenseDate: addDays(today, -5),
        userId: s2.id,
        forMonth: lastMonth,
        description: 'Monthly salary',
        recordedBy: owner.id,
        createdAt: at(addDays(today, -5), '10:05'),
      },
      {
        id: randomUUID(),
        businessId,
        type: 'salary',
        amountPaisa: 2_500_000,
        expenseDate: addDays(today, -5),
        userId: manager.id,
        forMonth: lastMonth,
        description: 'Monthly salary',
        recordedBy: owner.id,
        createdAt: at(addDays(today, -5), '10:10'),
      },
      {
        id: randomUUID(),
        businessId,
        type: 'miscellaneous',
        amountPaisa: 45_000,
        expenseDate: addDays(today, -3),
        userId: manager.id,
        description: 'Packing tape and bags',
        recordedBy: manager.id,
        createdAt: at(addDays(today, -3), '12:00'),
      },
    ];
    for (const p of plansOut.filter((x) => x.status !== 'planned')) {
      const fuelBill: Img =
        p.date === addDays(today, -1)
          ? await image(
              'expense-receipts',
              ['Fuel bill', `Rs 500 · ${p.date}`],
              50,
            )
          : null;
      exp.push({
        id: randomUUID(),
        businessId,
        type: 'fuel',
        amountPaisa: between(40, 50) * 1000,
        expenseDate: p.date,
        userId: p.salesmanId,
        dayPlanId: p.id,
        description: 'Motorbike fuel',
        receiptKey: fuelBill?.key ?? null,
        recordedBy: p.salesmanId,
        createdAt: at(p.date, '17:00'),
      });
      exp.push({
        id: randomUUID(),
        businessId,
        type: 'khaja',
        amountPaisa: between(15, 20) * 1000,
        expenseDate: p.date,
        userId: p.salesmanId,
        dayPlanId: p.id,
        description: 'Khaja on route',
        recordedBy: p.salesmanId,
        createdAt: at(p.date, '13:30'),
      });
    }
    await tx.insert(expenses).values(exp);
    bump('expenses', exp.length);

    // ---- final warehouse stock and the invoice counter
    for (const [id, qty] of warehouse) {
      if (qty < 0)
        throw new Error(
          `Demo seed would take stock below zero for product ${id}`,
        );
      await tx
        .update(products)
        .set({ stockQuantity: qty })
        .where(eq(products.id, id));
    }
    await tx
      .update(invoiceCounters)
      .set({ lastNumber: invoice })
      .where(eq(invoiceCounters.businessId, businessId));

    return {
      logins: newShops.map((s) => ({
        type: 'shop' as const,
        role: 'shop',
        name: s.name,
        email: s.email,
        password: SHOP_PASSWORD,
      })),
      counts: { ...counts, images: images.length },
    };
  });
}
