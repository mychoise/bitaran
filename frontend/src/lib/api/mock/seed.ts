// DEMO DATA ONLY. Every name, number and phone here is made up.
// Built fresh from today's Nepal date with a fixed random seed, so the demo always looks current
// and the same seed gives the same data. The staff and shop ids match the login mock accounts.

import { addDays, nepalDateOf, nepalInstant, todayNepal, type BusinessDate } from "../../dates.ts";
import type {
  Business,
  Category,
  DayPlan,
  DayPlanStatus,
  Expense,
  Payment,
  Product,
  Return,
  Route,
  Sale,
  Shop,
  Staff,
  StockLine,
  VisitPhoto,
  WriteOff,
} from "../types.ts";
import { priceLine } from "./rules.ts";

export const DEMO_DATA_VERSION = 4;

export type StoredCategory = Omit<Category, "productCount">;

export type DemoData = {
  version: number;
  seededOn: BusinessDate;
  business: Business;
  staff: Staff[];
  /** Stored without productCount, which is worked out when asked. */
  categories: StoredCategory[];
  products: Product[];
  routes: Route[];
  shops: Shop[];
  dayPlans: DayPlan[];
  sales: Sale[];
  payments: Payment[];
  returns: Return[];
  writeOffs: WriteOff[];
  expenses: Expense[];
  photos: VisitPhoto[];
  /** Images captured in the app (data URLs), by id. Seeded images are drawn, not stored. */
  images: Record<string, string>;
};

/** Seeded images are drawn locally from their id (see DemoImage); nothing is fetched. */
export const demoImageId = (kind: "cheque" | "screenshot" | "shop" | "bill", n: number) => `demo-img:${kind}:${n}`;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rupees = (r: number) => Math.round(r * 100);

export function seedDemoData(today: BusinessDate = todayNepal()): DemoData {
  const rand = rng(20261014);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

  const business: Business = {
    id: "b-demo",
    name: "Example Traders (demo)",
    pan: "600000000 (demo)",
    phone: "+977 9800000000",
    email: "office@example.com",
    address: "Demo Road, Ward 1 (demo address)",
    city: "Pokhara",
    registrationNo: "",
  };

  const staff: Staff[] = [
    { id: "u-owner", fullName: "Test Owner", role: "owner", email: "owner@example.com", phone: "+977 9800000001", active: true, joinedOn: addDays(today, -400), lastLoginAt: nepalInstant(addDays(today, 0), "08:10") },
    { id: "u-manager", fullName: "Test Manager", role: "manager", email: "manager@example.com", phone: "+977 9800000002", active: true, joinedOn: addDays(today, -300), lastLoginAt: nepalInstant(addDays(today, 0), "08:45") },
    { id: "u-salesman", fullName: "Test Salesman", role: "salesman", email: "salesman@example.com", phone: "+977 9800000003", active: true, joinedOn: addDays(today, -200), lastLoginAt: nepalInstant(addDays(today, 0), "07:30") },
    { id: "u-salesman2", fullName: "Test Salesman Two", role: "salesman", email: "salesman2@example.com", phone: "+977 9800000004", active: true, joinedOn: addDays(today, -90), lastLoginAt: nepalInstant(addDays(today, -1), "18:20") },
  ];

  const categories: StoredCategory[] = [
    { id: "c-snacks", name: "Noodles and snacks" },
    { id: "c-staples", name: "Oil and staples" },
    { id: "c-household", name: "Soap and household" },
  ];

  // [name, category, unit, units per carton, unit price in rupees, starting stock in units]
  const catalogue: [string, string, string, number, number, number][] = [
    ["Demo instant noodles, chicken", "c-snacks", "packet", 30, 25, 1800],
    ["Demo instant noodles, veg", "c-snacks", "packet", 30, 25, 1500],
    ["Demo cup noodles", "c-snacks", "cup", 24, 60, 480],
    ["Demo glucose biscuits", "c-snacks", "packet", 48, 15, 2400],
    ["Demo cream biscuits", "c-snacks", "packet", 36, 30, 900],
    ["Demo potato chips", "c-snacks", "packet", 40, 20, 1200],
    ["Demo bhujia mix", "c-snacks", "packet", 30, 50, 60],
    ["Demo chocolate bar", "c-snacks", "bar", 48, 40, 720],
    ["Demo mustard oil, 1 litre", "c-staples", "bottle", 12, 300, 600],
    ["Demo soybean oil, 1 litre", "c-staples", "pouch", 12, 260, 540],
    ["Demo sugar, 1 kg", "c-staples", "packet", 25, 110, 750],
    ["Demo salt, 1 kg", "c-staples", "packet", 50, 25, 1000],
    ["Demo rice, 5 kg", "c-staples", "bag", 4, 550, 40],
    ["Demo lentils, 1 kg", "c-staples", "packet", 20, 180, 400],
    ["Demo tea leaves, 500 g", "c-staples", "packet", 24, 220, 360],
    ["Demo milk powder, 400 g", "c-staples", "packet", 24, 420, 18],
    ["Demo bathing soap", "c-household", "bar", 72, 45, 1440],
    ["Demo washing soap", "c-household", "bar", 60, 35, 1200],
    ["Demo detergent powder, 1 kg", "c-household", "packet", 20, 160, 300],
    ["Demo dishwash bar", "c-household", "bar", 60, 30, 900],
    ["Demo toothpaste, 100 g", "c-household", "tube", 48, 110, 480],
    ["Demo shampoo sachet strip", "c-household", "strip", 40, 60, 25],
    ["Demo matchbox, 10 pack", "c-household", "pack", 50, 20, 800],
    ["Demo candles, 6 pack", "c-household", "pack", 40, 45, 320],
    ["Demo mosquito coil", "c-household", "box", 60, 50, 600],
  ];
  const SKU_PREFIX: Record<string, string> = { "c-snacks": "SNK", "c-staples": "STP", "c-household": "HSE" };
  const products: Product[] = catalogue.map(([name, categoryId, unitName, unitsPerCarton, price, stock], i) => {
    const unitPricePaisa = rupees(price);
    return {
      id: `p-${String(i + 1).padStart(2, "0")}`,
      name,
      sku: `DEMO-${SKU_PREFIX[categoryId]}-${String(i + 1).padStart(3, "0")}`,
      categoryId,
      unitName,
      unitsPerCarton,
      unitPricePaisa,
      // A carton is about 5% cheaper than the same units bought loose, rounded to the rupee.
      cartonPricePaisa: Math.round((unitPricePaisa * unitsPerCarton * 0.95) / 100) * 100,
      costPricePaisa: Math.round((unitPricePaisa * 0.82) / 100) * 100,
      stockUnits: stock,
      lowStockUnits: unitsPerCarton * 2,
      active: true,
    };
  });

  const shopRows: [string, string, string, string][] = [
    ["s-shop", "Test Kirana Pasal", "r-bagar", "Bagar"],
    ["s-shop2", "Test General Store", "r-bagar", "Bagar"],
    ["s-demo1", "Demo Bhandar", "r-bagar", "Mahendrapul"],
    ["s-demo2", "Demo Fancy Store", "r-bagar", "Prithvi Chowk"],
    ["s-demo3", "Demo Grocery", "r-bagar", "Lamachaur"],
    ["s-shop3", "Test Mini Mart", "r-lakeside", "Chipledhunga"],
    ["s-demo4", "Demo Kirana", "r-lakeside", "Mahendrapul"],
    ["s-demo5", "Demo Suppliers", "r-lakeside", "Srijana Chowk"],
    ["s-demo6", "Demo Mart", "r-lakeside", "Baidam"],
    ["s-demo7", "Demo Traders", "r-lakeside", "Lakeside"],
  ];
  const shops: Shop[] = shopRows.map(([id, name, routeId, place], i) => ({
    id,
    name,
    ownerName: `Demo Owner ${i + 1}`,
    phone: `+977 98000001${String(i).padStart(2, "0")}`,
    address: `${place}, Pokhara (demo)`,
    routeId,
    creditLimitPaisa: rupees(pick([20_000, 30_000, 40_000, 60_000])),
    openingBalancePaisa: rupees(pick([0, 0, 2_500, 8_000, 12_000])),
    dueDays: pick([7, 15]),
    active: true,
    hasLogin: id.startsWith("s-shop"),
  }));
  // One shop starts near its limit so the credit rule shows up in the demo.
  shops[2].creditLimitPaisa = rupees(20_000);
  shops[2].openingBalancePaisa = rupees(17_500);

  const routes: Route[] = [
    { id: "r-bagar", name: "Bagar to Lamachaur", shopIds: shops.filter((s) => s.routeId === "r-bagar").map((s) => s.id) },
    { id: "r-lakeside", name: "Chipledhunga to Lakeside", shopIds: shops.filter((s) => s.routeId === "r-lakeside").map((s) => s.id) },
  ];

  // ---- day plans, sales, payments, photos -------------------------------------------------
  const dayPlans: DayPlan[] = [];
  const sales: Sale[] = [];
  const payments: Payment[] = [];
  const photos: VisitPhoto[] = [];
  let invoiceNo = 1;
  let imageN = 1;
  let photoN = 1;

  type PlanSpec = { offset: number; salesmanId: string; routeId: string; status: DayPlanStatus };
  const specs: PlanSpec[] = [];
  for (let d = -7; d <= -2; d++) {
    specs.push({ offset: d, salesmanId: "u-salesman", routeId: d % 2 ? "r-bagar" : "r-lakeside", status: "reconciled" });
    specs.push({ offset: d, salesmanId: "u-salesman2", routeId: d % 2 ? "r-lakeside" : "r-bagar", status: "reconciled" });
  }
  specs.push({ offset: -1, salesmanId: "u-salesman", routeId: "r-lakeside", status: "closed" });
  specs.push({ offset: -1, salesmanId: "u-salesman2", routeId: "r-bagar", status: "reconciled" });
  specs.push({ offset: 0, salesmanId: "u-salesman", routeId: "r-bagar", status: "in_progress" });
  specs.push({ offset: 0, salesmanId: "u-salesman2", routeId: "r-lakeside", status: "planned" });
  specs.push({ offset: 1, salesmanId: "u-salesman", routeId: "r-lakeside", status: "planned" });

  for (const [n, spec] of specs.entries()) {
    const date = addDays(today, spec.offset);
    const route = routes.find((r) => r.id === spec.routeId)!;
    const carried = [...products].sort(() => rand() - 0.5).slice(0, 6);
    const issued: StockLine[] = carried.map((p) => ({ productId: p.id, units: (p.unitsPerCarton ?? 12) * between(1, 2) }));
    const plan: DayPlan = {
      id: `d-${String(n + 1).padStart(2, "0")}`,
      date,
      salesmanId: spec.salesmanId,
      routeId: route.id,
      status: spec.status,
      issued,
      visits: route.shopIds.map((shopId) => ({ shopId, status: "pending" })),
    };
    dayPlans.push(plan);
    if (spec.status === "planned") continue;

    plan.startedAt = nepalInstant(date, "09:10");
    const remaining = new Map(issued.map((l) => [l.productId, l.units]));
    // A day in progress has visited the first shops only.
    const visitCount = spec.status === "in_progress" ? 2 : route.shopIds.length;
    let collected = 0;

    for (const [v, visit] of plan.visits.entries()) {
      if (v >= visitCount) break;
      if (spec.status !== "in_progress" && rand() < 0.15) {
        visit.status = "skipped";
        visit.skipReason = "Shop closed";
        continue;
      }
      const hh = 9 + v + Math.floor(rand() * 0.9);
      const at = nepalInstant(date, `${String(hh).padStart(2, "0")}:${String(between(10, 50)).padStart(2, "0")}`);
      visit.status = "visited";
      visit.at = at;
      photos.push({ id: `ph-${photoN++}`, planId: plan.id, shopId: visit.shopId, salesmanId: plan.salesmanId, takenAt: at, deviceTakenAt: at, distanceM: between(5, 40), imageId: demoImageId("shop", photos.length + 1), flags: [] });

      // Keep room so today's route always has sales of its own; about 40 in all.
      if ((spec.status !== "in_progress" && sales.length >= 37) || rand() < 0.2) continue;
      const shop = shops.find((s) => s.id === visit.shopId)!;
      const lines = [...remaining.entries()]
        .filter(([, left]) => left > 0)
        .sort(() => rand() - 0.5)
        .slice(0, between(1, 3))
        .map(([productId, left]) => {
          const product = products.find((p) => p.id === productId)!;
          const asCarton = product.unitsPerCarton !== null && left >= product.unitsPerCarton && rand() < 0.3;
          const qty = asCarton ? 1 : Math.min(left, between(2, 10));
          const line = priceLine(product, qty, asCarton ? "carton" : "unit");
          remaining.set(productId, left - line.baseUnits);
          return line;
        });
      if (!lines.length) continue;
      const sale: Sale = {
        id: `sale-${invoiceNo}`,
        invoiceNo: invoiceNo++,
        date,
        createdAt: at,
        planId: plan.id,
        salesmanId: plan.salesmanId,
        shopId: shop.id,
        lines,
        totalPaisa: lines.reduce((a, l) => a + l.totalPaisa, 0),
        dueDate: addDays(date, shop.dueDays),
        status: "confirmed",
      };
      sales.push(sale);
      // About half of sales are paid in cash on the spot.
      if (rand() < 0.5) {
        const amount = rand() < 0.7 ? sale.totalPaisa : Math.round(sale.totalPaisa / 200) * 100;
        collected += amount;
        payments.push({ id: `pay-${payments.length + 1}`, date, createdAt: at, shopId: shop.id, salesmanId: plan.salesmanId, planId: plan.id, saleId: sale.id, method: "cash", amountPaisa: amount, status: "confirmed", imageIds: [] });
      }
    }

    if (spec.status !== "in_progress") {
      plan.closedAt = nepalInstant(date, "18:20");
      plan.reportedUnsold = [...remaining.entries()].map(([productId, units]) => ({ productId, units }));
      plan.cashHandedOverPaisa = collected;
      if (spec.status === "reconciled") {
        plan.reconciledAt = nepalInstant(date, "19:05");
        // The manager's count matches, except one plan where a unit is missing.
        plan.counted = plan.reportedUnsold.map((l, i) => ({ productId: l.productId, units: n === 3 && i === 0 && l.units > 0 ? l.units - 1 : l.units }));
        plan.cashCountedPaisa = collected;
      }
    }
  }

  // One cancelled sale (it keeps its number) on an older plan, without payments against it.
  const toCancel = sales.find((s) => s.date <= addDays(today, -4) && !payments.some((p) => p.saleId === s.id));
  if (toCancel) {
    toCancel.status = "cancelled";
    toCancel.cancelledAt = nepalInstant(toCancel.date, "17:00");
    toCancel.cancelReason = "Entered for the wrong shop (demo)";
  }

  // Cheque and online payments in every state, with drawn image placeholders.
  const nonCash: [string, number, Payment["method"], Payment["status"], number][] = [
    ["s-demo1", -6, "cheque", "confirmed", 15_000],
    ["s-demo4", -5, "cheque", "bounced", 8_000],
    ["s-shop", -2, "cheque", "pending", 12_000],
    ["s-demo2", -1, "cheque", "pending", 6_500],
    ["s-shop3", -3, "online", "confirmed", 4_200],
    ["s-demo5", -2, "online", "confirmed", 3_000],
    ["s-shop2", -1, "online", "pending", 2_750],
  ];
  for (const [shopId, offset, method, status, amount] of nonCash) {
    const date = addDays(today, offset);
    const salesmanId = dayPlans.find((p) => p.date === date && routes.find((r) => r.id === p.routeId)?.shopIds.includes(shopId))?.salesmanId ?? "u-salesman";
    payments.push({
      id: `pay-${payments.length + 1}`,
      date,
      createdAt: nepalInstant(date, "13:30"),
      shopId,
      salesmanId,
      method,
      amountPaisa: rupees(amount),
      status,
      chequeNo: method === "cheque" ? String(between(100000, 999999)) : undefined,
      imageIds: [demoImageId(method === "cheque" ? "cheque" : "screenshot", imageN++)],
      decidedAt: status === "pending" ? undefined : nepalInstant(addDays(date, 2), "11:00"),
      decidedBy: status === "pending" ? undefined : "u-manager",
    });
  }

  // Flag three visit photos so the manager's review has something to look at.
  const flagged: VisitPhoto["flags"][] = [["old_photo"], ["far_from_shop"], ["duplicate"]];
  flagged.forEach((flags, i) => {
    const photo = photos[3 + i * 5];
    if (!photo) return;
    photo.flags = flags;
    if (flags[0] === "old_photo") photo.deviceTakenAt = nepalInstant(addDays(nepalDateOf(photo.takenAt), -3), "10:00");
    if (flags[0] === "far_from_shop") photo.distanceM = 1400;
    if (flags[0] === "duplicate") photo.imageId = photos[0].imageId;
  });

  const returns: Return[] = [
    retOf("ret-1", "s-shop", -5, "u-salesman", "p-04", 6, "expired", false),
    retOf("ret-2", "s-demo2", -3, "u-salesman", "p-09", 2, "damaged", false),
    retOf("ret-3", "s-demo6", -2, "u-salesman2", "p-17", 4, "other", true),
  ];
  function retOf(id: string, shopId: string, offset: number, salesmanId: string, productId: string, units: number, reason: "damaged" | "expired" | "other", restocked: boolean): Return {
    const product = products.find((p) => p.id === productId)!;
    const value = product.unitPricePaisa * units;
    const date = addDays(today, offset);
    return { id, date, createdAt: nepalInstant(date, "15:00"), shopId, salesmanId, lines: [{ productId, units, reason, restocked, valuePaisa: value }], valuePaisa: value };
  }

  const writeOffs: WriteOff[] = [
    { id: "wo-1", date: addDays(today, -4), productId: "p-11", units: 3, reason: "damaged", note: "Bags torn in the store (demo)", createdBy: "u-manager" },
    { id: "wo-2", date: addDays(today, -1), productId: "p-16", units: 2, reason: "expired", note: "Past its date (demo)", createdBy: "u-manager" },
  ];

  const expenses: Expense[] = [];
  const expense = (staffId: string, type: Expense["type"], offset: number, amount: number, note: string, bill = false) =>
    expenses.push({ id: `exp-${expenses.length + 1}`, date: addDays(today, offset), staffId, type, amountPaisa: rupees(amount), note, billImageId: bill ? demoImageId("bill", imageN++) : undefined });
  expense("u-salesman", "salary", -5, 18_000, "Monthly salary (demo)");
  expense("u-salesman2", "salary", -5, 16_000, "Monthly salary (demo)");
  for (let d = -6; d <= -1; d++) {
    expense("u-salesman", "fuel", d, 450, "Motorbike fuel (demo)", d % 2 === 0);
    expense("u-salesman", "khaja", d, 180, "Khaja on route (demo)");
    if (d % 2) expense("u-salesman2", "fuel", d, 400, "Motorbike fuel (demo)", true);
  }
  expense("u-manager", "misc", -3, 300, "Packing tape (demo)", true);

  return { version: DEMO_DATA_VERSION, seededOn: today, business, staff, categories, products, routes, shops, dayPlans, sales, payments, returns, writeOffs, expenses, photos, images: {} };
}
