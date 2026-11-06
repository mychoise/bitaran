// The mock ApiClient: answers from the in-browser demo store, scoped by who is logged in,
// following the same rules the backend will (rules.ts). Reads work now; each write action is
// built to the same rules the backend must follow.

import { addDays, nepalDateOf, todayNepal, type BusinessDate } from "../../dates.ts";
import { formatMoney } from "../../money.ts";
import type { z } from "zod";
import { ApiError, type ApiClient } from "../client.ts";
import {
  businessSchema,
  categoryNameField,
  firstIssue,
  productCreateSchema,
  productSchema,
  productUpdateSchema,
  routeNameField,
  shopCreateSchema,
  shopSchema,
  shopUpdateSchema,
  staffSchema,
  staffUpdateSchema,
  temporaryPasswordField,
} from "../schemas.ts";
import type { Business, Category, DateRange, DayPlan, DayReport, Expense, Id, Payment, Return, Sale, Visit, VisitPhoto, VisitShop, WriteOff, Page, PageQuery, Product, Shop, ShopInvoice, ShopWithBalance, Staff, StatementEntry, Viewer } from "../types.ts";
import {
  canDecidePayment,
  cancelledGoodsGo,
  checkCancel,
  checkWriteOff,
  lineUnits,
  checkDueDate,
  checkExpense,
  checkExpensePlan,
  salesInRange,
  unitsSold,
  salesmanHistory,
  expenseSummary,
  checkReturnLines,
  checkSaleLines,
  checkCreditLimit,
  distanceMeters,
  initialPaymentStatus,
  mayRestock,
  nextInvoiceNo,
  photoFlags,
  priceLine,
  remainingOnPlan,
  returnable,
  returnValue,
  saleMoney,
  salesmanNumbers,
  validatePayment,
  collectable,
  canStartPlan,
  checkAddVisit,
  checkClose,
  checkVisitChange,
  shopNeedsLogin,
  canDeletePlan,
  canPlanFor,
  cashOnPlan,
  checkIssue,
  checkReconcile,
  planClash,
  planShortage,
  soldOnPlan,
  adjustStock,
  balanceParts,
  canDeleteCategory,
  canDeleteRoute,
  checkLoginPair,
  checkRouteShops,
  creditUsage,
  itemsTaken,
  panTaken,
  shopEmailTaken,
  startingTerms,
  categoryNameTaken,
  checkPasswordReset,
  checkStaffChange,
  emailTaken,
  isLowStock,
  overdueItems,
  rolesCreatableBy,
  shopBalance,
  skuTaken,
} from "./rules.ts";
import type { StoredCategory } from "./seed.ts";
import { failureSimulated } from "./flags.ts";
import { getData, save } from "./store.ts";

const DELAY_MS = 250;
/**
 * Answers after a short delay, as a server would. Each answer is a fresh copy, like JSON off
 * the wire: the store's own objects never leave the mock, so a change made later is a new
 * answer (React Query sees it) and a screen can never change the store by accident.
 */
const later = <T,>(value: () => T): Promise<T> => new Promise((resolve, reject) => setTimeout(() => {
  if (failureSimulated()) return reject(new ApiError("unreachable", "Simulated connection failure"));
  try {
    resolve(structuredClone(value()));
  } catch (err) {
    reject(err);
  }
}, DELAY_MS));

/** A short fingerprint of an image's data, to spot the same picture sent twice (FNV-1a). */
function fingerprint(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(16)}-${data.length}`;
}

const forbidden = (message = "You do not have access to this.") => new ApiError("forbidden", message);
const invalid = (message: string) => new ApiError("invalid", message);
const EMAIL_IN_USE = "Someone on your staff already uses this email.";
const SKU_IN_USE = "Another product already uses this SKU.";
const CATEGORY_IN_USE = "There is already a category with this name.";
const PAN_IN_USE = "Another shop already has this PAN.";
const SHOP_EMAIL_IN_USE = "Another shop already signs in with this email.";

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
  /** Cost price is never sent to salesmen or shops. The image comes with its address. */
  const shapeProduct = (p: Product): Product => {
    const imageUrl = p.imageId ? getData().images[p.imageId] : undefined;
    return isManager ? { ...p, imageUrl } : { ...p, imageUrl, costPricePaisa: undefined };
  };
  const findProduct = (id: Id) => {
    const p = getData().products.find((x) => x.id === id);
    if (!p) throw notFound("product");
    return p;
  };
  const withCount = (c: StoredCategory): Category => ({ ...c, productCount: getData().products.filter((p) => p.categoryId === c.id).length });
  /** An attached image must have been uploaded first. */
  const checkImage = (imageId: Id) => {
    if (!getData().images[imageId]) throw invalid("Upload the image again.");
    return imageId;
  };

  const today = () => todayNepal();
  const findShop = (id: Id) => {
    const s = getData().shops.find((x) => x.id === id);
    if (!s) throw notFound("shop");
    return s;
  };
  const findRoute = (id: Id) => {
    const r = getData().routes.find((x) => x.id === id);
    if (!r) throw notFound("route");
    return r;
  };
  const findPlan = (id: Id) => {
    const p = getData().dayPlans.find((x) => x.id === id);
    if (!p) throw notFound("day plan");
    return p;
  };
  /**
   * The same submit twice (a double tap, a retry after a dropped connection) makes one record:
   * the first result is remembered under its key and returned again.
   */
  function once<T extends { id: string }>(key: string, kind: string, find: (id: string) => T | undefined, make: () => T): T {
    if (typeof key !== "string" || key.length < 8 || key.length > 100) throw invalid("Something went wrong. Please try again.");
    const d = getData();
    const seen = d.idempotency[key];
    if (seen) {
      const earlier = seen.kind === kind ? find(seen.id) : undefined;
      if (earlier) return earlier;
      throw new ApiError("conflict", "This was already sent. Reload to see it.");
    }
    const made = make();
    d.idempotency[key] = { kind, id: made.id };
    save();
    return made;
  }
  /** A visit the salesman may act on now: their own plan, in progress. */
  const onVisit = (visitId: Id) => {
    const { plan, visit } = findVisit(visitId);
    if (!isSalesman || plan.salesmanId !== viewer.id) throw forbidden("Only the salesman on this route can do this.");
    if (plan.status !== "in_progress") throw invalid(plan.status === "planned" ? "Start the day first." : "This day is closed. Nothing can change now.");
    return { plan, visit, shop: findShop(visit.shopId) };
  };
  /** Anything recorded at a shop counts as visiting it. */
  const markVisited = (visit: Visit) => {
    if (visit.status === "visited") return;
    visit.status = "visited";
    visit.at = new Date().toISOString();
    delete visit.skipReason;
  };
  /** The salesman's own plan, for the actions only they may take on it. */
  const myPlan = (id: Id) => {
    const plan = findPlan(id);
    if (!isSalesman || plan.salesmanId !== viewer.id) throw forbidden("Only the salesman on this route can do this.");
    return plan;
  };
  const findVisit = (id: Id) => {
    for (const plan of own(getData().dayPlans)) {
      const visit = plan.visits.find((v) => v.id === id);
      if (visit) return { plan, visit };
    }
    throw notFound("visit");
  };
  const visitShop = (plan: DayPlan, visit: Visit): VisitShop => {
    const bought = getData().sales.filter((s) => s.planId === plan.id && s.shopId === visit.shopId && s.status === "confirmed");
    return {
      visit,
      planId: plan.id,
      planStatus: plan.status,
      position: plan.visits.indexOf(visit) + 1,
      shop: withBalance(findShop(visit.shopId)),
      todayPurchasesPaisa: bought.reduce((a, s) => a + s.totalPaisa, 0),
      todaySalesCount: bought.length,
    };
  };
  /** An image's address: drawn demo images keep their id; uploaded ones are data in the store. */
  const imageUrl = (id: Id) => (id.startsWith("demo-img:") ? id : (getData().images[id] ?? ""));
  const shapeSale = (s: Sale): Sale => ({ ...s, paidPaisa: getData().payments.filter((p) => p.saleId === s.id && p.status === "confirmed").reduce((a, p) => a + p.amountPaisa, 0) });
  const shapePayment = (p: Payment): Payment => ({ ...p, imageUrls: p.imageIds.map(imageUrl) });
  const shapePhoto = (p: VisitPhoto): VisitPhoto => ({ ...p, imageUrl: imageUrl(p.imageId) });
  /** A sale as its shop sees it: product and salesman names, no internal ids or cost. */
  const shopInvoice = (s: Sale, withPayments = false): ShopInvoice => {
    const d = getData();
    const shaped = shapeSale(s);
    return {
      id: s.id,
      invoiceNo: s.invoiceNo,
      date: s.date,
      createdAt: s.createdAt,
      dueDate: s.dueDate,
      status: s.status,
      lines: s.lines.map((l) => {
        const product = d.products.find((x) => x.id === l.productId);
        return { productName: product?.name ?? "A product", unitName: product?.unitName ?? "unit", unit: l.unit, quantity: l.quantity, pricePaisa: l.pricePaisa, totalPaisa: l.totalPaisa };
      }),
      subtotalPaisa: s.subtotalPaisa,
      discountPaisa: s.discountPaisa ?? 0,
      totalPaisa: s.totalPaisa,
      paidPaisa: shaped.paidPaisa ?? 0,
      salesmanName: d.staff.find((x) => x.id === s.salesmanId)?.fullName ?? "Your salesman",
      cancelledAt: s.cancelledAt,
      cancelReason: s.cancelReason,
      payments: withPayments ? d.payments.filter((p) => p.saleId === s.id).sort(newestFirst).map((p) => ({ date: p.date, method: p.method, amountPaisa: p.amountPaisa, status: p.status })) : undefined,
    };
  };
  const shapeExpense = (e: Expense): Expense => (e.billImageId ? { ...e, billImageUrl: imageUrl(e.billImageId) } : e);
  /** Salary must be for an active staff member, and a day plan must be that person's. */
  const checkExpenseRefs = (e: Pick<Expense, "staffId" | "planId">) => {
    const d = getData();
    const person = d.staff.find((x) => x.id === e.staffId);
    if (!person) throw invalid("That staff member was not found.");
    if (e.planId) {
      const problem = checkExpensePlan(d.dayPlans.find((x) => x.id === e.planId), e.staffId);
      if (problem) throw invalid(problem);
    }
  };
  /** A plan with its stock, cash, sales, payments and visits worked out. */
  const dayReport = (plan: DayPlan): DayReport => {
    const d = getData();
    const off = d.writeOffs.filter((w) => w.planId === plan.id);
    const sold = soldOnPlan(plan.id, d.sales);
    const reported = new Map((plan.reportedUnsold ?? []).map((l) => [l.productId, l.units]));
    const counted = plan.counted ? new Map(plan.counted.map((l) => [l.productId, l.units])) : null;
    const shortages = new Map(planShortage(plan, d.sales, off).map((r) => [r.productId, r.shortage]));
    const stock = plan.issued.map((l) => {
      const s = sold.get(l.productId) ?? 0;
      const w = off.filter((x) => x.productId === l.productId).reduce((a, x) => a + x.units, 0);
      const known = counted !== null || plan.reportedUnsold !== undefined;
      return {
        productId: l.productId,
        issued: l.units,
        sold: s,
        remaining: l.units - s - w,
        reportedUnsold: plan.reportedUnsold ? (reported.get(l.productId) ?? 0) : null,
        counted: counted ? (counted.get(l.productId) ?? 0) : null,
        writtenOff: w,
        shortage: known ? (shortages.get(l.productId) ?? 0) : null,
      };
    });
    const collectedPaisa = cashOnPlan(plan.id, d.payments);
    const against = plan.cashCountedPaisa ?? plan.cashHandedOverPaisa ?? null;
    const planSales = d.sales.filter((x) => x.planId === plan.id && x.status === "confirmed");
    const planPayments = d.payments.filter((x) => x.planId === plan.id);
    return {
      plan,
      stock,
      cash: { collectedPaisa, handedOverPaisa: plan.cashHandedOverPaisa ?? null, countedPaisa: plan.cashCountedPaisa ?? null, differencePaisa: against === null ? null : against - collectedPaisa },
      sales: { count: planSales.length, totalPaisa: planSales.reduce((a, x) => a + x.totalPaisa, 0) },
      payments: (["cash", "cheque", "online"] as const)
        .map((method) => {
          const ps = planPayments.filter((x) => x.method === method && x.status !== "bounced");
          return { method, count: ps.length, amountPaisa: ps.reduce((a, x) => a + x.amountPaisa, 0), pendingCount: ps.filter((x) => x.status === "pending").length };
        })
        .filter((x) => x.count > 0),
      visits: {
        visited: plan.visits.filter((v) => v.status === "visited").length,
        skipped: plan.visits.filter((v) => v.status === "skipped").length,
        pending: plan.visits.filter((v) => v.status === "pending").length,
      },
    };
  };
  /** PANs are unique within the business, and shop login emails across shops. */
  const checkShopClashes = (pan: string, loginEmail: string | undefined, exceptId?: Id) => {
    const shops = getData().shops;
    if (panTaken(shops, pan, exceptId)) throw new ApiError("conflict", PAN_IN_USE);
    if (loginEmail && shopEmailTaken(shops, loginEmail, exceptId)) throw new ApiError("conflict", SHOP_EMAIL_IN_USE);
  };
  const withBalance = (shop: Shop): ShopWithBalance => {
    const d = getData();
    const { balancePaisa, inClearingPaisa } = shopBalance(shop, d.sales, d.payments, d.returns);
    const overdue = overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30));
    const panImageUrl = shop.panImageId ? d.images[shop.panImageId] : undefined;
    return { ...shop, panImageUrl, balancePaisa, inClearingPaisa, overduePaisa: overdue.reduce((a, o) => a + o.unpaidPaisa, 0) };
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

    categories: {
      list: () => later(() => {
        requireStaff();
        const d = getData();
        return d.categories.map(withCount).sort((x, y) => x.name.localeCompare(y.name));
      }),
      create: (name) => later(() => {
        requireManager();
        const d = getData();
        const clean = parse(categoryNameField, name);
        if (categoryNameTaken(d.categories, clean)) throw new ApiError("conflict", CATEGORY_IN_USE);
        const category = { id: `c-${Date.now().toString(36)}`, name: clean };
        d.categories.push(category);
        save();
        return withCount(category);
      }),
      rename: (id, name) => later(() => {
        requireManager();
        const d = getData();
        const category = d.categories.find((c) => c.id === id);
        if (!category) throw notFound("category");
        const clean = parse(categoryNameField, name);
        if (categoryNameTaken(d.categories, clean, id)) throw new ApiError("conflict", CATEGORY_IN_USE);
        category.name = clean;
        save();
        return withCount(category);
      }),
      remove: (id) => later(() => {
        requireManager();
        const d = getData();
        if (!d.categories.some((c) => c.id === id)) throw notFound("category");
        const check = canDeleteCategory(id, d.products);
        if (!check.ok) throw new ApiError("conflict", check.reason);
        d.categories = d.categories.filter((c) => c.id !== id);
        save();
      }),
    },

    products: {
      list: (q = {}) => later(() => {
        requireStaff();
        const term = q.search?.trim().toLowerCase();
        const items = getData()
          .products.filter(
            (p) =>
              (!q.categoryId || p.categoryId === q.categoryId) &&
              (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)) &&
              (!q.lowStock || isLowStock(p)) &&
              (q.active === undefined || p.active === q.active),
          )
          .sort((x, y) => x.name.localeCompare(y.name))
          .map(shapeProduct);
        return paginate(items, q);
      }),
      get: (id) => later(() => {
        requireStaff();
        return shapeProduct(findProduct(id));
      }),
      create: (input) => later(() => {
        requireManager();
        const d = getData();
        const fields = parse(productCreateSchema, input);
        if (!d.categories.some((c) => c.id === fields.categoryId)) throw invalid("Choose a category.");
        if (skuTaken(d.products, fields.sku)) throw new ApiError("conflict", SKU_IN_USE);
        const { imageId, ...rest } = fields;
        const product: Product = { id: `p-${Date.now().toString(36)}`, ...rest };
        if (imageId) product.imageId = checkImage(imageId);
        d.products.push(product);
        save();
        return shapeProduct(product);
      }),
      update: (id, input) => later(() => {
        requireManager();
        const d = getData();
        const product = findProduct(id);
        const { imageId, ...fields } = parse(productUpdateSchema, input);
        // Stock changes only through adjustStock (and, later, day plans and returns).
        const next: Product = { ...product, ...fields, stockUnits: product.stockUnits };
        parse(productSchema, next);
        if (!d.categories.some((c) => c.id === next.categoryId)) throw invalid("Choose a category.");
        if (skuTaken(d.products, next.sku, id)) throw new ApiError("conflict", SKU_IN_USE);
        if (imageId === null) delete next.imageId;
        else if (imageId !== undefined) next.imageId = checkImage(imageId);
        delete next.imageUrl;
        Object.assign(product, next);
        if (!next.imageId) delete product.imageId;
        save();
        return shapeProduct(product);
      }),
      adjustStock: (id, deltaUnits) => later(() => {
        requireManager();
        const product = findProduct(id);
        const result = adjustStock(product.stockUnits, deltaUnits);
        if (!result.ok) throw invalid(result.reason);
        // Not logged yet: the stock moves, but no record of who or why is kept.
        product.stockUnits = result.stockUnits;
        save();
        return shapeProduct(product);
      }),
    },

    routes: {
      list: () => later(() => {
        requireStaff();
        return getData().routes;
      }),
      get: (id) => later(() => {
        requireStaff();
        return findRoute(id);
      }),
      create: (input) => later(() => {
        requireManager();
        const route = { id: `r-${Date.now().toString(36)}`, name: parse(routeNameField, input.name), shopIds: [] };
        getData().routes.push(route);
        save();
        return route;
      }),
      update: (id, input) => later(() => {
        requireManager();
        const route = findRoute(id);
        route.name = parse(routeNameField, input.name);
        save();
        return route;
      }),
      remove: (id) => later(() => {
        requireManager();
        const d = getData();
        const check = canDeleteRoute(findRoute(id), d.dayPlans);
        if (!check.ok) throw new ApiError("conflict", check.reason);
        d.routes = d.routes.filter((r) => r.id !== id);
        save();
      }),
      setShops: (id, shopIds) => later(() => {
        requireManager();
        const d = getData();
        const route = findRoute(id);
        const problem = checkRouteShops(shopIds, new Set(d.shops.map((s) => s.id)));
        if (problem) throw invalid(problem);
        // Shops dropped from this route are on no route; shops added leave their old one.
        for (const s of d.shops) {
          if (s.routeId === id && !shopIds.includes(s.id)) s.routeId = null;
          if (shopIds.includes(s.id) && s.routeId !== id) {
            const old = d.routes.find((r) => r.id === s.routeId);
            if (old) old.shopIds = old.shopIds.filter((x) => x !== s.id);
            s.routeId = id;
          }
        }
        route.shopIds = [...shopIds];
        save();
        return route;
      }),
    },

    shops: {
      list: (q = {}) => later(() => {
        requireStaff();
        const term = q.search?.trim().toLowerCase();
        const items = getData()
          .shops.filter(
            (s) =>
              (!q.routeId || (q.routeId === "none" ? s.routeId === null : s.routeId === q.routeId)) &&
              (q.active === undefined || s.active === q.active) &&
              (!term || [s.name, s.ownerName, s.phone, s.pan].some((v) => v.toLowerCase().includes(term))),
          )
          .sort((x, y) => x.name.localeCompare(y.name))
          .map(withBalance)
          .filter((s) => !q.overdue || s.overduePaisa > 0);
        return paginate(items, q);
      }),
      get: (id) => later(() => {
        requireStaff();
        return withBalance(findShop(id));
      }),
      create: (input) => later(() => {
        requireStaff();
        const me = actor();
        const d = getData();
        const { loginEmail, temporaryPassword, panImageId, ...fields } = parse(shopCreateSchema, input);
        if (shopNeedsLogin(me.role) && !loginEmail) throw invalid("A shop you add needs a login: an email and a temporary password.");
        checkShopClashes(fields.pan, loginEmail);
        const login = checkLoginPair(loginEmail, temporaryPassword);
        if (login) throw invalid(login);
        if (fields.routeId) findRoute(fields.routeId);
        // A salesman's shop starts with no credit limit and no opening balance.
        const terms = startingTerms(me.role, fields);
        const shop: Shop = { id: `s-${Date.now().toString(36)}`, ...terms, active: true, hasLogin: Boolean(loginEmail), loginEmail, createdByRole: me.role };
        if (panImageId) shop.panImageId = checkImage(panImageId);
        // The temporary password goes to the auth service; the demo never stores it.
        d.shops.push(shop);
        if (shop.routeId) findRoute(shop.routeId).shopIds.push(shop.id);
        save();
        return withBalance(shop);
      }),
      update: (id, input) => later(() => {
        requireManager();
        const d = getData();
        const shop = findShop(id);
        const { loginEmail, temporaryPassword, panImageId, ...fields } = parse(shopUpdateSchema, input);
        const next: Shop = { ...shop, ...fields };
        parse(shopSchema, next);
        checkShopClashes(next.pan, loginEmail, id);
        if (loginEmail !== undefined || temporaryPassword !== undefined) {
          // A shop without a login gets one with both; a shop with one may just change its email.
          if (!shop.hasLogin) {
            const login = checkLoginPair(loginEmail, temporaryPassword);
            if (login) throw invalid(login);
          }
          if (loginEmail) next.loginEmail = loginEmail;
          next.hasLogin = Boolean(next.loginEmail);
          if (temporaryPassword) next.passwordResetAt = new Date().toISOString();
        }
        if (next.routeId !== shop.routeId) {
          if (next.routeId) findRoute(next.routeId).shopIds.push(id);
          const old = d.routes.find((r) => r.id === shop.routeId);
          if (old) old.shopIds = old.shopIds.filter((x) => x !== id);
        }
        if (panImageId === null) delete next.panImageId;
        else if (panImageId !== undefined) next.panImageId = checkImage(panImageId);
        delete (next as Partial<ShopWithBalance>).panImageUrl;
        Object.assign(shop, next);
        if (!next.panImageId) delete shop.panImageId;
        save();
        return withBalance(shop);
      }),
      resetPassword: (id, temporaryPassword) => later(() => {
        requireManager();
        const shop = findShop(id);
        if (!shop.hasLogin) throw invalid("This shop has no login yet. Give it one in Details.");
        parse(temporaryPasswordField, temporaryPassword);
        // Only the time is kept. The password itself is never stored or logged.
        shop.passwordResetAt = new Date().toISOString();
        save();
      }),
      balance: (id) => later(() => {
        requireStaff();
        const d = getData();
        const shop = findShop(id);
        const parts = balanceParts(shop, d.sales, d.payments, d.returns);
        const overdue = overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30));
        return {
          ...parts,
          overduePaisa: overdue.reduce((a, o) => a + o.unpaidPaisa, 0),
          creditLimitPaisa: shop.creditLimitPaisa,
          creditUsedPaisa: creditUsage(parts.balancePaisa, shop.creditLimitPaisa).usedPaisa,
        };
      }),
      statement: (id, range) => later(() => {
        requireStaff();
        return statementFor(findShop(id), range);
      }),
      returnable: (id) => later(() => {
        requireStaff();
        const d = getData();
        const shop = findShop(id);
        const ids = [...new Set(d.sales.filter((x) => x.shopId === shop.id && x.status === "confirmed").flatMap((x) => x.lines.map((l) => l.productId)))];
        return ids.map((productId) => ({ productId, units: returnable(productId, shop.id, d.sales, d.returns) })).filter((x) => x.units > 0);
      }),
      itemsTaken: (id, range) => later(() => {
        requireStaff();
        return itemsTaken(getData().sales, findShop(id).id, range);
      }),
    },

    dayPlans: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().dayPlans)
          .filter((p) => (!f.salesmanId || p.salesmanId === f.salesmanId) && (!f.status || p.status === f.status) && inRange(p.date, f))
          .sort((a, b) => b.date.localeCompare(a.date) || a.salesmanId.localeCompare(b.salesmanId));
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
      create: (input) => later(() => {
        requireManager();
        const d = getData();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw invalid("Choose a date.");
        if (!canPlanFor(input.date, today())) throw invalid("Plans are for today or a day ahead, not a day that has gone.");
        const salesman = d.staff.find((s) => s.id === input.salesmanId && s.role === "salesman");
        if (!salesman) throw invalid("Choose a salesman.");
        if (!salesman.active) throw invalid(`${salesman.fullName} is inactive. Activate their account first, or choose someone else.`);
        const route = findRoute(input.routeId);
        if (route.shopIds.length === 0) throw invalid("This route has no shops yet. Add shops to it first.");
        if (planClash(d.dayPlans, input)) throw new ApiError("conflict", `${salesman.fullName} already has a plan for ${route.name} on that date.`);
        const { problems, totals } = checkIssue(input.lines, d.products);
        if (problems.length) throw invalid(problems[0].message);
        // Issuing takes the stock out of the warehouse.
        for (const [productId, units] of totals) d.products.find((p) => p.id === productId)!.stockUnits -= units;
        const plan: DayPlan = {
          id: `d-${Date.now().toString(36)}`,
          date: input.date,
          salesmanId: salesman.id,
          routeId: route.id,
          status: "planned",
          issued: [...totals].map(([productId, units]) => ({ productId, units })),
          visits: [],
          createdAt: new Date().toISOString(),
        };
        plan.visits = route.shopIds.map((shopId, i) => ({ id: `${plan.id}-v${i + 1}`, shopId, status: "pending" }));
        d.dayPlans.push(plan);
        save();
        return plan;
      }),
      remove: (id) => later(() => {
        requireManager();
        const d = getData();
        const plan = findPlan(id);
        if (!canDeletePlan(plan)) throw new ApiError("conflict", "Only a planned day can be deleted. Once started, it stays for the record.");
        // Its stock goes back to the warehouse.
        for (const l of plan.issued) {
          const product = d.products.find((p) => p.id === l.productId);
          if (product) product.stockUnits += l.units;
        }
        d.dayPlans = d.dayPlans.filter((p) => p.id !== id);
        save();
      }),
      start: (id) => later(() => {
        const plan = myPlan(id);
        const check = canStartPlan(plan, getData().dayPlans, today());
        if (!check.ok) throw new ApiError("conflict", check.reason ?? "This day cannot be started.");
        plan.status = "in_progress";
        plan.startedAt = new Date().toISOString();
        save();
        return plan;
      }),
      shops: (id) => later(() => {
        requireStaff();
        const plan = own(getData().dayPlans).find((x) => x.id === id);
        if (!plan) throw notFound("day plan");
        return plan.visits.map((v) => visitShop(plan, v));
      }),
      addVisit: (id, shopId) => later(() => {
        const plan = myPlan(id);
        const shop = findShop(shopId);
        const problem = checkAddVisit(plan, shop);
        if (problem) throw invalid(problem);
        const visit: Visit = { id: `${plan.id}-v${Date.now().toString(36)}`, shopId, status: "pending", adHoc: true };
        plan.visits.push(visit);
        save();
        return visitShop(plan, visit);
      }),
      close: (id, input) => later(() => {
        const d = getData();
        const plan = myPlan(id);
        const problem = checkClose(plan, input.reportedUnsold, input.cashHandedOverPaisa, d.sales, d.writeOffs.filter((w) => w.planId === id));
        if (problem) throw invalid(problem);
        Object.assign(plan, {
          status: "closed",
          reportedUnsold: input.reportedUnsold.map((l) => ({ productId: l.productId, units: l.units })),
          cashHandedOverPaisa: input.cashHandedOverPaisa,
          closedAt: new Date().toISOString(),
        });
        save();
        return plan;
      }),
      reconcile: (id, input) => later(() => {
        requireManager();
        const d = getData();
        const plan = findPlan(id);
        const off = d.writeOffs.filter((w) => w.planId === id);
        const problem = checkReconcile(plan, input.counted, d.sales, off);
        if (problem) throw invalid(problem);
        if (!Number.isInteger(input.cashCountedPaisa) || input.cashCountedPaisa < 0) throw invalid("Enter the cash you counted, in rupees.");
        if (input.notes.length > 1000) throw invalid("Keep the notes under 1,000 characters.");
        // What the manager counted goes back into the warehouse.
        for (const l of input.counted) {
          const product = d.products.find((p) => p.id === l.productId);
          if (product) product.stockUnits += l.units;
        }
        Object.assign(plan, {
          status: "reconciled",
          counted: input.counted.map((l) => ({ productId: l.productId, units: l.units })),
          cashCountedPaisa: input.cashCountedPaisa,
          reconcileNotes: input.notes.trim(),
          reconciledBy: viewer.id,
          reconciledAt: new Date().toISOString(),
        });
        save();
        return plan;
      }),
      report: (id) => later(() => {
        requireStaff();
        const d = getData();
        const plan = own(d.dayPlans).find((x) => x.id === id);
        if (!plan) throw notFound("day plan");
        return dayReport(plan);
      }),
    },

    visits: {
      get: (id) => later(() => {
        requireStaff();
        const { plan, visit } = findVisit(id);
        return visitShop(plan, visit);
      }),
      update: (id, input) => later(() => {
        const { plan, visit } = findVisit(id);
        if (!isSalesman || plan.salesmanId !== viewer.id) throw forbidden("Only the salesman on this route can change its visits.");
        const problem = checkVisitChange(plan.status, visit, input);
        if (problem) throw invalid(problem);
        visit.status = input.status;
        visit.at = new Date().toISOString();
        if (input.status === "skipped") visit.skipReason = input.skipReason!.trim();
        else delete visit.skipReason;
        save();
        return visitShop(plan, visit);
      }),
    },

    sales: {
      create: (input) => later(() =>
        once(input.idempotencyKey, "sale", (id) => getData().sales.find((x) => x.id === id), () => {
          const d = getData();
          const { plan, visit, shop } = onVisit(input.visitId);
          const me = actor();
          const problems = checkSaleLines(input.lines, d.products, remainingOnPlan(plan, d.sales));
          if (problems.length) throw invalid(problems[0]);
          // Prices come from the product records, never from the request.
          const lines = input.lines.map((l) => priceLine(d.products.find((p) => p.id === l.productId)!, l.quantity, l.unit));
          const money = saleMoney(lines, input.discountPaisa, input.cashPaidPaisa);
          if (money.problems.length) throw invalid(money.problems[0]);
          const date = today();
          const dueDate = input.dueDate ?? addDays(date, shop.dueDays);
          const due = checkDueDate(dueDate, date);
          if (due) throw invalid(due);
          const { balancePaisa } = shopBalance(shop, d.sales, d.payments, d.returns);
          const credit = checkCreditLimit(balancePaisa, money.creditPaisa, shop.creditLimitPaisa, me.role);
          if (!credit.ok && !(credit.canOverride && input.overrideCreditLimit)) {
            throw new ApiError("conflict", `This sale takes ${shop.name} over its credit limit by ${formatMoney(credit.overByPaisa)}. ${credit.canOverride ? "Confirm the override to go ahead." : "Ask your manager, or take more in cash."}`);
          }
          const now = new Date().toISOString();
          const sale: Sale = {
            id: `sale-${Date.now().toString(36)}`,
            invoiceNo: nextInvoiceNo(d.sales),
            date,
            createdAt: now,
            planId: plan.id,
            visitId: visit.id,
            salesmanId: plan.salesmanId,
            shopId: shop.id,
            lines,
            subtotalPaisa: money.subtotalPaisa,
            discountPaisa: money.discountPaisa,
            cashPaidPaisa: money.cashPaidPaisa,
            totalPaisa: money.totalPaisa,
            dueDate,
            status: "confirmed",
          };
          if (!credit.ok) sale.limitOverrideBy = me.id;
          d.sales.push(sale);
          if (money.cashPaidPaisa > 0) {
            d.payments.push({ id: `pay-${Date.now().toString(36)}`, date, createdAt: now, shopId: shop.id, salesmanId: plan.salesmanId, planId: plan.id, visitId: visit.id, saleId: sale.id, method: "cash", amountPaisa: money.cashPaidPaisa, status: "confirmed", imageIds: [] });
          }
          markVisited(visit);
          return shapeSale(sale);
        }),
      ),
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().sales)
          .filter((s) => (!f.shopId || s.shopId === f.shopId) && (!f.salesmanId || s.salesmanId === f.salesmanId) && (!f.planId || s.planId === f.planId) && (!f.status || s.status === f.status) && inRange(s.date, f))
          .sort(newestFirst)
          .map(shapeSale);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const s = own(getData().sales).find((x) => x.id === id);
        if (!s) throw notFound("sale");
        return shapeSale(s);
      }),
      cancel: (id, reason) => later(() => {
        requireManager();
        const d = getData();
        const sale = d.sales.find((x) => x.id === id);
        if (!sale) throw notFound("sale");
        const problem = checkCancel(sale, d.payments, reason);
        if (problem) throw new ApiError(problem.includes("confirmed payment") || problem.includes("already") ? "conflict" : "invalid", problem);
        // While its day is open the goods are back with the salesman (counted at reconcile);
        // once the day is counted, or with no day, they go back into the warehouse.
        const plan = d.dayPlans.find((p) => p.id === sale.planId);
        if (cancelledGoodsGo(plan?.status) === "warehouse") {
          for (const l of sale.lines) {
            const product = d.products.find((p) => p.id === l.productId);
            if (product) product.stockUnits += l.baseUnits;
          }
        }
        Object.assign(sale, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: reason.trim(), cancelledBy: viewer.id });
        save();
        return shapeSale(sale);
      }),
    },

    payments: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().payments)
          .filter((p) => (!f.shopId || p.shopId === f.shopId) && (!f.salesmanId || p.salesmanId === f.salesmanId) && (!f.planId || p.planId === f.planId) && (!f.saleId || p.saleId === f.saleId) && (!f.method || p.method === f.method) && (!f.status || p.status === f.status) && inRange(p.date, f))
          .sort(newestFirst)
          .map(shapePayment);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const p = own(getData().payments).find((x) => x.id === id);
        if (!p) throw notFound("payment");
        return shapePayment(p);
      }),
      create: (input) => later(() =>
        once(input.idempotencyKey, "payment", (id) => getData().payments.find((x) => x.id === id), () => {
          const d = getData();
          const { plan, visit, shop } = onVisit(input.visitId);
          const owed = withBalance(shop);
          const problems = validatePayment(input, new Set(d.payments.flatMap((p) => p.imageIds)), collectable(owed.balancePaisa, owed.inClearingPaisa));
          if (problems.length) throw invalid(problems[0]);
          input.imageIds.forEach(checkImage);
          if (input.saleId && !d.sales.some((x) => x.id === input.saleId && x.shopId === shop.id && x.status === "confirmed")) throw invalid("That sale is not one of this shop's.");
          const payment: Payment = {
            id: `pay-${Date.now().toString(36)}`,
            date: today(),
            createdAt: new Date().toISOString(),
            shopId: shop.id,
            salesmanId: plan.salesmanId,
            planId: plan.id,
            visitId: visit.id,
            saleId: input.saleId,
            method: input.method,
            amountPaisa: input.amountPaisa,
            status: initialPaymentStatus(input.method),
            imageIds: [...input.imageIds],
          };
          if (input.method === "cheque") Object.assign(payment, { chequeNo: input.chequeNo!.trim(), bank: input.bank!.trim(), chequeDate: input.chequeDate });
          if (input.method === "online") payment.reference = input.reference!.trim();
          d.payments.push(payment);
          markVisited(visit);
          return shapePayment(payment);
        }),
      ),
      decide: (id, status) => later(() => {
        requireManager();
        const p = getData().payments.find((x) => x.id === id);
        if (!p) throw notFound("payment");
        if (status !== "confirmed" && status !== "bounced") throw invalid("Choose confirm or bounced.");
        if (!canDecidePayment(p)) throw new ApiError("conflict", `This payment is already ${p.status}. It cannot change now.`);
        Object.assign(p, { status, decidedBy: viewer.id, decidedAt: new Date().toISOString() });
        save();
        return shapePayment(p);
      }),
    },

    returns: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().returns).filter((r) => (!f.shopId || r.shopId === f.shopId) && (!f.salesmanId || r.salesmanId === f.salesmanId) && inRange(r.date, f)).sort(newestFirst);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const r = own(getData().returns).find((x) => x.id === id);
        if (!r) throw notFound("return");
        return r;
      }),
      create: (input) => later(() =>
        once(input.idempotencyKey, "return", (id) => getData().returns.find((x) => x.id === id), () => {
          const d = getData();
          // A salesman returns on a visit; a manager may record one for a shop directly.
          const onDay = input.visitId ? onVisit(input.visitId) : null;
          if (!onDay) requireManager();
          if (!onDay && !input.shopId) throw invalid("Choose the shop.");
          const shop = onDay ? onDay.shop : findShop(input.shopId!);
          const problems = checkReturnLines(input.lines, d.products, (pid) => returnable(pid, shop.id, d.sales, d.returns));
          if (problems.length) throw invalid(problems[0]);
          const lines = input.lines.map((l) => {
            const product = d.products.find((p) => p.id === l.productId)!;
            // The credited value is the product's price; only a manager may set another.
            const value = isManager && l.valuePaisa !== undefined && Number.isInteger(l.valuePaisa) && l.valuePaisa >= 0 ? l.valuePaisa : returnValue(l.units, product);
            const restocked = mayRestock(l.reason, l.restock);
            // Goods fine to sell again go back into the warehouse stock.
            if (restocked) product.stockUnits += l.units;
            return { productId: l.productId, units: l.units, reason: l.reason, restocked, valuePaisa: value };
          });
          const record: Return = {
            id: `ret-${Date.now().toString(36)}`,
            date: today(),
            createdAt: new Date().toISOString(),
            shopId: shop.id,
            salesmanId: onDay ? onDay.plan.salesmanId : viewer.id,
            planId: onDay?.plan.id,
            visitId: onDay?.visit.id,
            lines,
            valuePaisa: lines.reduce((a, l) => a + l.valuePaisa, 0),
          };
          d.returns.push(record);
          if (onDay) markVisited(onDay.visit);
          return record;
        }),
      ),
    },

    writeOffs: {
      list: (f = {}) => later(() => {
        requireManager();
        return paginate(getData().writeOffs.filter((w) => inRange(w.date, f)).sort(newestFirst), f);
      }),
      create: (input) => later(() =>
        once(input.idempotencyKey, "write-off", (id) => getData().writeOffs.find((x) => x.id === id), () => {
          requireManager();
          const d = getData();
          const product = findProduct(input.productId);
          const units = lineUnits({ unit: input.unit, quantity: input.quantity }, product);
          if (units === null) throw invalid(`${product.name} is not sold by the carton.`);
          const plan = input.planId ? findPlan(input.planId) : null;
          const problem = checkWriteOff({ units, reason: input.reason, note: input.note }, product, plan, d.sales, d.writeOffs);
          if (problem) throw invalid(problem);
          // From the warehouse it lowers the stock. On a day plan the stock already left the
          // warehouse when it was issued, so it is not lowered again; it counts on the plan.
          if (!plan) product.stockUnits -= units;
          const wo: WriteOff = {
            id: `wo-${Date.now().toString(36)}`,
            date: today(),
            createdAt: new Date().toISOString(),
            productId: product.id,
            units,
            unit: input.unit,
            quantity: input.quantity,
            reason: input.reason,
            note: input.note.trim(),
            planId: plan?.id,
            createdBy: viewer.id,
          };
          d.writeOffs.push(wo);
          return wo;
        }),
      ),
    },

    expenses: {
      list: (f = {}) => later(() => {
        requireStaff();
        const all = getData().expenses;
        const visible = isSalesman ? all.filter((e) => e.staffId === viewer.id) : all;
        const items = visible.filter((e) => (!f.staffId || e.staffId === f.staffId) && (!f.type || e.type === f.type) && inRange(e.date, f)).sort(newestFirst).map(shapeExpense);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const e = getData().expenses.find((x) => x.id === id && (!isSalesman || x.staffId === viewer.id));
        if (!e) throw notFound("expense");
        return shapeExpense(e);
      }),
      create: (input) => later(() =>
        once(input.idempotencyKey, "expense", (id) => getData().expenses.find((x) => x.id === id), () => {
          const d = getData();
          const me = actor();
          const problem = checkExpense(input, me, today());
          if (problem) throw invalid(problem);
          if (input.billImageId) checkImage(input.billImageId);
          const staffId = me.role === "salesman" ? me.id : (input.staffId ?? me.id);
          const planId = input.type === "fuel" || input.type === "khaja" ? input.planId || undefined : undefined;
          checkExpenseRefs({ staffId, planId });
          const expense: Expense = {
            id: `exp-${Date.now().toString(36)}`,
            date: input.date,
            staffId,
            type: input.type,
            amountPaisa: input.amountPaisa,
            note: input.note.trim(),
            billImageId: input.billImageId,
            planId,
            salaryMonth: input.type === "salary" ? input.salaryMonth : undefined,
            createdBy: me.id,
            createdAt: new Date().toISOString(),
          };
          d.expenses.push(expense);
          return shapeExpense(expense);
        }),
      ),
      update: (id, patch) => later(() => {
        requireManager();
        const d = getData();
        const e = d.expenses.find((x) => x.id === id);
        if (!e) throw notFound("expense");
        const next: Expense = { ...e };
        if (patch.staffId !== undefined) next.staffId = patch.staffId;
        if (patch.type !== undefined) next.type = patch.type;
        if (patch.amountPaisa !== undefined) next.amountPaisa = patch.amountPaisa;
        if (patch.date !== undefined) next.date = patch.date;
        if (patch.note !== undefined) next.note = patch.note.trim();
        if (patch.billImageId !== undefined) next.billImageId = patch.billImageId ?? undefined;
        if (patch.planId !== undefined) next.planId = patch.planId ?? undefined;
        if (patch.salaryMonth !== undefined) next.salaryMonth = patch.salaryMonth ?? undefined;
        // A day plan belongs only on fuel and khaja; a month only on salary.
        if (next.type !== "fuel" && next.type !== "khaja") next.planId = undefined;
        if (next.type !== "salary") next.salaryMonth = undefined;
        const problem = checkExpense(next, actor(), today());
        if (problem) throw invalid(problem);
        if (patch.billImageId) checkImage(patch.billImageId);
        checkExpenseRefs(next);
        Object.assign(e, next, { updatedAt: new Date().toISOString(), updatedBy: viewer.id });
        for (const k of ["planId", "salaryMonth", "billImageId"] as const) if (next[k] === undefined) delete e[k];
        return shapeExpense(e);
      }),
      summary: (f) => later(() => {
        requireManager();
        if (f.from > f.to) throw invalid("The start date is after the end date.");
        const items = getData().expenses.filter((e) => (!f.staffId || e.staffId === f.staffId) && (!f.type || e.type === f.type));
        return expenseSummary(items, f);
      }),
    },

    photos: {
      list: (f = {}) => later(() => {
        requireStaff();
        const items = own(getData().photos)
          .filter((p) => (!f.planId || p.planId === f.planId) && (!f.shopId || p.shopId === f.shopId) && (!f.salesmanId || p.salesmanId === f.salesmanId) && (!f.flagged || p.flags.length > 0) && inRange(nepalDateOf(p.takenAt), f))
          .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
          .map(shapePhoto);
        return paginate(items, f);
      }),
      get: (id) => later(() => {
        requireStaff();
        const p = own(getData().photos).find((x) => x.id === id);
        if (!p) throw notFound("photo");
        return shapePhoto(p);
      }),
      create: (input) => later(() =>
        once(input.idempotencyKey, "photo", (id) => getData().photos.find((x) => x.id === id), () => {
          const d = getData();
          const { plan, visit, shop } = onVisit(input.visitId);
          const url = d.images[checkImage(input.imageId)];
          if (input.note.length > 300) throw invalid("Keep the note under 300 characters.");
          const takenAt = new Date().toISOString();
          const distanceM =
            input.latitude !== undefined && input.longitude !== undefined && shop.latitude !== null && shop.longitude !== null
              ? distanceMeters({ latitude: input.latitude, longitude: input.longitude }, { latitude: shop.latitude, longitude: shop.longitude })
              : undefined;
          const known = new Set(d.photos.map((p) => d.images[p.imageId]).filter(Boolean).map(fingerprint));
          // Flags ask the manager to look; they never stop the photo being saved.
          const flags = photoFlags({ takenAt, deviceTakenAt: input.deviceTakenAt, distanceM, fingerprint: fingerprint(url), knownFingerprints: known });
          const photo: VisitPhoto = { id: `ph-${Date.now().toString(36)}`, planId: plan.id, shopId: shop.id, salesmanId: plan.salesmanId, visitId: visit.id, takenAt, deviceTakenAt: input.deviceTakenAt, distanceM, latitude: input.latitude, longitude: input.longitude, imageId: input.imageId, flags, note: input.note.trim() || undefined };
          d.photos.push(photo);
          markVisited(visit);
          return photo;
        }),
      ),
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
          cashTodayPaisa: d.payments.filter((p) => p.date === day && p.method === "cash" && p.status === "confirmed").reduce((a, p) => a + p.amountPaisa, 0),
          pendingPaymentCount: d.payments.filter((p) => p.status === "pending").length,
          inClearingPaisa: shops.reduce((a, s) => a + s.inClearingPaisa, 0),
          overduePaisa: shops.reduce((a, s) => a + s.overduePaisa, 0),
          overdueShopCount: shops.filter((s) => s.overduePaisa > 0).length,
          lowStockCount: d.products.filter((p) => p.active && isLowStock(p)).length,
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
      today: (range) => later(() => {
        requireStaff();
        if (range && isSalesman) throw forbidden("You can see only today's numbers.");
        if (range && range.from > range.to) throw invalid("The start date is after the end date.");
        const d = getData();
        return salesInRange(range ?? { from: today(), to: today() }, own(d.sales), own(d.payments));
      }),
      salesmanAnalytics: (salesmanId, range) => later(() => {
        requireStaff();
        if (isSalesman && salesmanId !== viewer.id) throw forbidden("You can see only your own numbers.");
        if (range.from > range.to) throw invalid("The start date is after the end date.");
        return salesmanNumbers(salesmanId, range, getData());
      }),
      salesmanHistory: (salesmanId, range) => later(() => {
        requireManager();
        if (range.from > range.to) throw invalid("The start date is after the end date.");
        const d = getData();
        if (!d.staff.some((x) => x.id === salesmanId)) throw notFound("salesman");
        return salesmanHistory(salesmanId, range, d.sales, d.payments);
      }),
      lowStock: (range) => later(() => {
        requireManager();
        const r = range ?? { from: addDays(today(), -29), to: today() };
        if (r.from > r.to) throw invalid("The start date is after the end date.");
        const sold = unitsSold(getData().sales, r);
        return getData().products.filter((p) => p.active && isLowStock(p)).map((p) => ({ ...shapeProduct(p), soldUnits: sold.get(p.id) ?? 0 }));
      }),
    },

    shopPortal: {
      me: () => later(() => {
        const shop = myShop();
        const b = getData().business;
        return {
          shopName: shop.name,
          ownerName: shop.ownerName,
          phone: shop.phone,
          address: shop.address,
          pan: shop.pan,
          registrationNo: shop.registrationNo,
          loginEmail: shop.loginEmail,
          business: { name: b.name, address: b.address, city: b.city, phone: b.phone, pan: b.pan },
        };
      }),
      summary: () => later(() => {
        const shop = myShop();
        const d = getData();
        const s = withBalance(shop);
        const overdue = overdueItems(shop, d.sales, d.payments, d.returns, today(), addDays(d.seededOn, -30));
        const last = d.payments.filter((p) => p.shopId === shop.id && p.status !== "bounced").sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
        return {
          shopName: shop.name,
          businessName: d.business.name,
          balancePaisa: s.balancePaisa,
          inClearingPaisa: s.inClearingPaisa,
          creditLimitPaisa: shop.creditLimitPaisa,
          creditUsedPaisa: creditUsage(s.balancePaisa, shop.creditLimitPaisa).usedPaisa,
          overduePaisa: s.overduePaisa,
          oldestOverdueDate: overdue[0]?.dueDate,
          lastPayment: last ? { date: last.date, amountPaisa: last.amountPaisa, method: last.method, status: last.status } : undefined,
        };
      }),
      statement: (range) => later(() => statementFor(myShop(), range)),
      invoices: (q = {}) => later(() => {
        const shop = myShop();
        const items = getData().sales.filter((s) => s.shopId === shop.id && inRange(s.date, q) && (!q.status || s.status === q.status)).sort(newestFirst);
        return paginate(items.map((s) => shopInvoice(s)), q);
      }),
      invoice: (id) => later(() => {
        const shop = myShop();
        const s = getData().sales.find((x) => x.id === id && x.shopId === shop.id);
        if (!s) throw notFound("invoice");
        return shopInvoice(s, true);
      }),
      payments: (q = {}) => later(() => {
        const shop = myShop();
        const d = getData();
        const items = d.payments
          .filter((p) => p.shopId === shop.id && inRange(p.date, q) && (!q.status || p.status === q.status))
          .sort(newestFirst)
          .map((p) => ({
            id: p.id,
            date: p.date,
            method: p.method,
            amountPaisa: p.amountPaisa,
            status: p.status,
            chequeNo: p.chequeNo,
            bank: p.bank,
            reference: p.reference,
            invoiceNo: p.saleId ? d.sales.find((x) => x.id === p.saleId)?.invoiceNo : undefined,
          }));
        return paginate(items, q);
      }),
      returns: (q = {}) => later(() => {
        const shop = myShop();
        const d = getData();
        const items = d.returns
          .filter((r) => r.shopId === shop.id && inRange(r.date, q))
          .sort(newestFirst)
          .map((r) => ({
            id: r.id,
            date: r.date,
            valuePaisa: r.valuePaisa,
            lines: r.lines.map((l) => {
              const product = d.products.find((x) => x.id === l.productId);
              return { productName: product?.name ?? "A product", unitName: product?.unitName ?? "unit", units: l.units, reason: l.reason };
            }),
          }));
        return paginate(items, q);
      }),
    },
  };
}
