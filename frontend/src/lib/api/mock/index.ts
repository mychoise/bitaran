// The mock ApiClient: answers from the in-browser demo store, scoped by who is logged in,
// following the same rules the backend will (rules.ts). Reads work now; each write action is
// built in the step that needs it and until then says so plainly.

import { addDays, todayNepal, type BusinessDate } from "../../dates.ts";
import type { z } from "zod";
import { ApiError, type ApiClient } from "../client.ts";
import { businessSchema, firstIssue, staffSchema, staffUpdateSchema, temporaryPasswordField } from "../schemas.ts";
import type { Business, DateRange, Id, Page, PageQuery, Product, Shop, ShopWithBalance, Staff, StatementEntry, Viewer } from "../types.ts";
import { checkPasswordReset, checkStaffChange, emailTaken, overdueItems, rolesCreatableBy, shopBalance } from "./rules.ts";
import { getData, save } from "./store.ts";

const DELAY_MS = 250;
const later = <T,>(value: () => T): Promise<T> => new Promise((resolve, reject) => setTimeout(() => {
  try {
    resolve(value());
  } catch (err) {
    reject(err);
  }
}, DELAY_MS));

const notBuiltYet = async (): Promise<never> => {
  throw new ApiError("not_built_yet", "This action is built in a later step.");
};
const forbidden = (message = "You do not have access to this.") => new ApiError("forbidden", message);
const invalid = (message: string) => new ApiError("invalid", message);
const EMAIL_IN_USE = "Someone on your staff already uses this email.";

/** Checks an input the way the backend will, throwing the first problem in plain words. */
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw invalid(firstIssue(r.error));
  return r.data;
}

/** Captured images are kept as data URLs in the demo store; this keeps one well under its limit. */
const MAX_DEMO_IMAGE_CHARS = 700_000;
const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(invalid("This image could not be read. Try another file."));
    reader.readAsDataURL(file);
  });
const notFound = (what: string) => new ApiError("not_found", `That ${what} was not found.`);

function paginate<T>(items: T[], q: PageQuery = {}): Page<T> {
  const pageSize = Math.min(Math.max(q.pageSize ?? 25, 1), 200);
  const page = Math.max(q.page ?? 1, 1);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

const inRange = (date: BusinessDate, r: DateRange = {}) => (!r.from || date >= r.from) && (!r.to || date <= r.to);
const newestFirst = <T extends { date: string; createdAt?: string }>(a: T, b: T) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

export function createMockClient(viewer: Viewer): ApiClient {
  const isStaff = viewer.type === "staff";
  const isManager = viewer.type === "staff" && viewer.role !== "salesman";
  const isSalesman = viewer.type === "staff" && viewer.role === "salesman";
  const requireStaff = () => {
    if (!isStaff) throw forbidden();
  };
  const requireManager = () => {
    if (!isManager) throw forbidden();
  };
  const requireOwner = () => {
    if (!(viewer.type === "staff" && viewer.role === "owner")) throw forbidden("Only the owner can change business settings.");
  };
  const actor = () => {
    if (viewer.type !== "staff") throw forbidden();
    return { id: viewer.id, role: viewer.role };
  };
  const findStaff = (id: Id) => {
    const s = getData().staff.find((x) => x.id === id);
    if (!s) throw notFound("person");
    return s;
  };
  const shapeBusiness = (b: Business): Business => ({ ...b, logoUrl: b.logoImageId ? getData().images[b.logoImageId] : undefined });
  const requireShop = () => {
    if (viewer.type !== "shop") throw forbidden();
  };
  /** A salesman sees only his own records. */
  const own = <T extends { salesmanId: Id }>(xs: T[]) => (isSalesman ? xs.filter((x) => x.salesmanId === viewer.id) : xs);
  /** Cost price is never sent to salesmen or shops. */
  const shapeProduct = (p: Product): Product => (isManager ? p : { ...p, costPricePaisa: undefined });

  const today = () => todayNepal();
  const withBalance = (shop: Shop): ShopWithBalance => {
    const d = getData();
    const { balancePaisa, inClearingPaisa } = shopBalance(shop, d.sales, d.payments, d.returns);
    const overdue = overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30));
    return { ...shop, balancePaisa, inClearingPaisa, overduePaisa: overdue.reduce((a, o) => a + o.unpaidPaisa, 0) };
  };

  function statementFor(shop: Shop, range: DateRange = {}): StatementEntry[] {
    const d = getData();
    const rows: Omit<StatementEntry, "balancePaisa">[] = [
      ...d.sales.filter((s) => s.shopId === shop.id && s.status === "confirmed").map((s) => ({ date: s.date, kind: "sale" as const, ref: `Invoice ${s.invoiceNo}`, debitPaisa: s.totalPaisa, creditPaisa: 0 })),
      ...d.payments.filter((p) => p.shopId === shop.id && p.status === "confirmed").map((p) => ({ date: p.date, kind: "payment" as const, ref: p.method === "cheque" ? `Cheque ${p.chequeNo ?? ""}`.trim() : p.method === "online" ? "Online payment" : "Cash payment", debitPaisa: 0, creditPaisa: p.amountPaisa })),
      ...d.returns.filter((r) => r.shopId === shop.id).map((r) => ({ date: r.date, kind: "return" as const, ref: "Return", debitPaisa: 0, creditPaisa: r.valuePaisa })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = shop.openingBalancePaisa;
    const all: StatementEntry[] = [{ date: addDays(d.seededOn, -30), kind: "opening", ref: "Opening balance", debitPaisa: Math.max(0, shop.openingBalancePaisa), creditPaisa: Math.max(0, -shop.openingBalancePaisa), balancePaisa: running }];
    for (const r of rows) {
      running += r.debitPaisa - r.creditPaisa;
      all.push({ ...r, balancePaisa: running });
    }
    return all.filter((e) => e.kind === "opening" || inRange(e.date, range));
  }

  const myShop = () => {
    requireShop();
    const shop = getData().shops.find((s) => s.id === viewer.id);
    if (!shop) throw notFound("shop");
    return shop;
  };

  return {
    viewer,

    business: {
      get: () => later(() => shapeBusiness(getData().business)),
      update: (input) => later(() => {
        requireOwner();
        const d = getData();
        const fields = parse(businessSchema.partial(), input);
        const next: Business = { ...d.business, ...fields };
        if (input.logoImageId === null) delete next.logoImageId;
        else if (input.logoImageId !== undefined) {
          if (!d.images[input.logoImageId]) throw invalid("Upload the logo again.");
          next.logoImageId = input.logoImageId;
        }
        delete next.logoUrl;
        d.business = next;
        save();
        return shapeBusiness(next);
      }),
    },

    staff: {
      list: (f = {}) => later(() => {
        requireStaff();
        const all = isManager ? getData().staff : getData().staff.filter((s) => s.id === viewer.id);
        const term = f.search?.trim().toLowerCase();
        return all.filter(
          (s) =>
            (!f.role || s.role === f.role) &&
            (f.active === undefined || s.active === f.active) &&
            (!term || [s.fullName, s.email, s.phone].some((v) => v.toLowerCase().includes(term))),
        );
      }),
      get: (id) => later(() => {
        requireStaff();
        if (!isManager && id !== viewer.id) throw forbidden();
        return findStaff(id);
      }),
      create: (input) => later(() => {
        requireManager();
        const me = actor();
        // The temporary password is checked, then dropped: the demo never stores it.
        parse(temporaryPasswordField, input.temporaryPassword);
        const fields = parse(staffSchema, input);
        if (!rolesCreatableBy(me.role).includes(fields.role)) throw forbidden(me.role === "manager" ? "A manager can add salesmen only." : "You cannot add staff.");
        const d = getData();
        if (emailTaken(d.staff, fields.email)) throw new ApiError("conflict", EMAIL_IN_USE);
        const person: Staff = { id: `u-${Date.now().toString(36)}`, ...fields, active: true, joinedOn: today() };
        d.staff.push(person);
        save();
        return person;
      }),
      update: (id, input) => later(() => {
        requireManager();
        const target = findStaff(id);
        const fields = parse(staffUpdateSchema, input);
        const problem = checkStaffChange(actor(), target, { role: fields.role, active: fields.active });
        if (problem) throw forbidden(problem);
        if (fields.email && emailTaken(getData().staff, fields.email, id)) throw new ApiError("conflict", EMAIL_IN_USE);
        Object.assign(target, fields);
        save();
        return target;
      }),
      resetPassword: (id, temporaryPassword) => later(() => {
        requireManager();
        const target = findStaff(id);
        const problem = checkPasswordReset(actor(), target);
        if (problem) throw forbidden(problem);
        parse(temporaryPasswordField, temporaryPassword);
        // Only the time is kept. The password itself is never stored or logged.
        target.passwordResetAt = new Date().toISOString();
        save();
      }),
    },

    uploads: {
      image: async (file) => {
        if (!isStaff) throw forbidden();
        const url = await readAsDataUrl(file);
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(url)) throw invalid("Choose a PNG, JPEG or WebP image.");
        if (url.length > MAX_DEMO_IMAGE_CHARS) throw invalid("This image is too large for the demo. Try a smaller one.");
        return later(() => {
          const d = getData();
          const id = `img-${Date.now().toString(36)}`;
          d.images[id] = url;
          save();
          return { id, url };
        });
      },
    },

    products: {
      categories: () => later(() => getData().categories),
      list: (q = {}) => later(() => {
        requireStaff();
        const term = q.search?.trim().toLowerCase();
        const items = getData().products
          .filter((p) => (!q.categoryId || p.categoryId === q.categoryId) && (!term || p.name.toLowerCase().includes(term)) && (!q.lowStock || p.stockUnits <= p.lowStockUnits))
          .map(shapeProduct);
        return paginate(items, q);
      }),
      get: (id) => later(() => {
        requireStaff();
        const p = getData().products.find((x) => x.id === id);
        if (!p) throw notFound("product");
        return shapeProduct(p);
      }),
      create: notBuiltYet,
      update: notBuiltYet,
    },

    shops: {
      routes: () => later(() => {
        requireStaff();
        return getData().routes;
      }),
      list: (q = {}) => later(() => {
        requireStaff();
        const term = q.search?.trim().toLowerCase();
        const items = getData().shops
          .filter((s) => (!q.routeId || s.routeId === q.routeId) && (!term || s.name.toLowerCase().includes(term)))
          .map(withBalance)
          .filter((s) => !q.overdue || s.overduePaisa > 0);
        return paginate(items, q);
      }),
      get: (id) => later(() => {
        requireStaff();
        const s = getData().shops.find((x) => x.id === id);
        if (!s) throw notFound("shop");
        return withBalance(s);
      }),
      statement: (id, range) => later(() => {
        requireStaff();
        const s = getData().shops.find((x) => x.id === id);
        if (!s) throw notFound("shop");
        return statementFor(s, range);
      }),
      create: notBuiltYet,
      update: notBuiltYet,
    },

    dayPlans: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().dayPlans)
          .filter((p) => (!f.salesmanId || p.salesmanId === f.salesmanId) && (!f.status || p.status === f.status) && inRange(p.date, f))
          .sort((a, b) => b.date.localeCompare(a.date));
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const p = own(getData().dayPlans).find((x) => x.id === id);
        if (!p) throw notFound("day plan");
        return p;
      }),
      today: () => later(() => {
        requireStaff();
        const t = today();
        const mine = getData().dayPlans.filter((p) => p.salesmanId === viewer.id);
        return mine.find((p) => p.status === "in_progress") ?? mine.find((p) => p.date === t) ?? null;
      }),
      create: notBuiltYet,
      remove: notBuiltYet,
      start: notBuiltYet,
      markVisit: notBuiltYet,
      close: notBuiltYet,
      reconcile: notBuiltYet,
    },

    sales: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().sales)
          .filter((s) => (!f.shopId || s.shopId === f.shopId) && (!f.salesmanId || s.salesmanId === f.salesmanId) && (!f.planId || s.planId === f.planId) && (!f.status || s.status === f.status) && inRange(s.date, f))
          .sort(newestFirst);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const s = own(getData().sales).find((x) => x.id === id);
        if (!s) throw notFound("sale");
        return s;
      }),
      create: notBuiltYet,
      cancel: notBuiltYet,
    },

    payments: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().payments)
          .filter((p) => (!f.shopId || p.shopId === f.shopId) && (!f.salesmanId || p.salesmanId === f.salesmanId) && (!f.method || p.method === f.method) && (!f.status || p.status === f.status) && inRange(p.date, f))
          .sort(newestFirst);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const p = own(getData().payments).find((x) => x.id === id);
        if (!p) throw notFound("payment");
        return p;
      }),
      create: notBuiltYet,
      confirm: notBuiltYet,
      markBounced: notBuiltYet,
    },

    returns: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().returns).filter((r) => (!f.shopId || r.shopId === f.shopId) && (!f.salesmanId || r.salesmanId === f.salesmanId) && inRange(r.date, f)).sort(newestFirst);
        return paginate(items, f);
      }),
      create: notBuiltYet,
    },

    writeOffs: {
      list: (f = {}) => later(() => {
        requireManager();
        return paginate(getData().writeOffs.filter((w) => inRange(w.date, f)).sort(newestFirst), f);
      }),
      create: notBuiltYet,
    },

    expenses: {
      list: (f = {}) => later(() => {
        requireStaff();
        const all = getData().expenses;
        const visible = isSalesman ? all.filter((e) => e.staffId === viewer.id) : all;
        const items = visible.filter((e) => (!f.staffId || e.staffId === f.staffId) && (!f.type || e.type === f.type) && inRange(e.date, f)).sort(newestFirst);
        return paginate(items, f);
      }),
      create: notBuiltYet,
    },

    photos: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().photos)
          .filter((p) => (!f.planId || p.planId === f.planId) && (!f.shopId || p.shopId === f.shopId) && (!f.flagged || p.flags.length > 0))
          .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
        return paginate(items, f);
      }),
      create: notBuiltYet,
    },

    reports: {
      dashboard: (date) => later(() => {
        requireManager();
        const d = getData();
        const day = date ?? today();
        const sold = d.sales.filter((s) => s.date === day && s.status === "confirmed");
        const shops = d.shops.map(withBalance);
        const plansByStatus = { planned: 0, in_progress: 0, closed: 0, reconciled: 0 };
        for (const p of d.dayPlans.filter((x) => x.date === day)) plansByStatus[p.status]++;
        return {
          date: day,
          salesTodayPaisa: sold.reduce((a, s) => a + s.totalPaisa, 0),
          salesTodayCount: sold.length,
          collectedTodayPaisa: d.payments.filter((p) => p.date === day && p.status === "confirmed").reduce((a, p) => a + p.amountPaisa, 0),
          inClearingPaisa: shops.reduce((a, s) => a + s.inClearingPaisa, 0),
          overduePaisa: shops.reduce((a, s) => a + s.overduePaisa, 0),
          overdueShopCount: shops.filter((s) => s.overduePaisa > 0).length,
          lowStockCount: d.products.filter((p) => p.stockUnits <= p.lowStockUnits).length,
          plansByStatus,
          flaggedPhotoCount: d.photos.filter((p) => p.flags.length > 0).length,
        };
      }),
      salesByDay: (range) => later(() => {
        requireManager();
        const by = new Map<string, { totalPaisa: number; count: number }>();
        for (const s of getData().sales) if (s.status === "confirmed" && inRange(s.date, range)) {
          const row = by.get(s.date) ?? { totalPaisa: 0, count: 0 };
          row.totalPaisa += s.totalPaisa;
          row.count++;
          by.set(s.date, row);
        }
        return [...by].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
      }),
      salesBySalesman: (range) => later(() => {
        requireManager();
        const by = new Map<string, { totalPaisa: number; count: number }>();
        for (const s of getData().sales) if (s.status === "confirmed" && inRange(s.date, range)) {
          const row = by.get(s.salesmanId) ?? { totalPaisa: 0, count: 0 };
          row.totalPaisa += s.totalPaisa;
          row.count++;
          by.set(s.salesmanId, row);
        }
        return [...by].map(([salesmanId, v]) => ({ salesmanId, ...v }));
      }),
      overdue: () => later(() => {
        requireManager();
        const d = getData();
        return d.shops
          .map((shop) => ({ shop, items: overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30)) }))
          .filter((x) => x.items.length)
          .map((x) => ({ shopId: x.shop.id, overduePaisa: x.items.reduce((a, i) => a + i.unpaidPaisa, 0), oldestDueDate: x.items[0].dueDate }))
          .sort((a, b) => a.oldestDueDate.localeCompare(b.oldestDueDate));
      }),
      lowStock: () => later(() => {
        requireManager();
        return getData().products.filter((p) => p.stockUnits <= p.lowStockUnits);
      }),
    },

    shopPortal: {
      summary: () => later(() => {
        const shop = myShop();
        const d = getData();
        const s = withBalance(shop);
        const overdue = overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30));
        return { shopName: shop.name, businessName: d.business.name, balancePaisa: s.balancePaisa, inClearingPaisa: s.inClearingPaisa, creditLimitPaisa: shop.creditLimitPaisa, overduePaisa: s.overduePaisa, oldestOverdueDate: overdue[0]?.dueDate };
      }),
      statement: (range) => later(() => statementFor(myShop(), range)),
      invoices: (q = {}) => later(() => {
        const shop = myShop();
        return paginate(getData().sales.filter((s) => s.shopId === shop.id && inRange(s.date, q)).sort(newestFirst), q);
      }),
      invoice: (id) => later(() => {
        const shop = myShop();
        const s = getData().sales.find((x) => x.id === id && x.shopId === shop.id);
        if (!s) throw notFound("invoice");
        return s;
      }),
      payments: (q = {}) => later(() => {
        const shop = myShop();
        return paginate(getData().payments.filter((p) => p.shopId === shop.id && inRange(p.date, q)).sort(newestFirst), q);
      }),
      returns: (q = {}) => later(() => {
        const shop = myShop();
        return paginate(getData().returns.filter((r) => r.shopId === shop.id && inRange(r.date, q)).sort(newestFirst), q);
      }),
    },
  };
}
