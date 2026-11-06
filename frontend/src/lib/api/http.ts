import { nepalDateOf, todayNepal, type BusinessDate } from "../dates.ts";
import { ApiError, type ApiClient, type ApiErrorCode } from "./client.ts";
import { expenseSummary, salesInRange } from "./mock/rules.ts";
import type {
  Business,
  DayPlan,
  DayPlanStatus,
  DayReport,
  Expense,
  ExpenseType,
  Id,
  Page,
  Payment,
  PaymentMethod,
  PhotoFlag,
  Product,
  Return,
  Route,
  Sale,
  SaleLine,
  ShopInvoice,
  ShopWithBalance,
  Staff,
  StatementEntry,
  StockLine,
  Viewer,
  Visit,
  VisitPhoto,
  VisitShop,
  WriteOff,
} from "./types.ts";

// The real backend (NestJS, /api/v1), reached through this app's own /api/backend route, which
// adds the access token from the httpOnly session cookie. Each method below turns the backend's
// shapes into the ones the screens use (src/lib/api/types.ts) and back. Where the backend has no
// call for something, the method says so with a "not available from the backend yet" error,
// and docs/backend-gaps.md lists it.

const BASE = "/api/backend";
const PAGE_MAX = 100;

// ---- the wire ------------------------------------------------------------------------------------

type Query = Record<string, string | number | boolean | undefined | null>;
type Wire = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- backend JSON, shaped by the adapters below
type BackendPage<T = Wire> = { data: T[]; page: number; limit: number; total: number };

const STATUS_CODE = (status: number): ApiErrorCode =>
  status === 404 ? "not_found" : status === 403 ? "forbidden" : status === 409 ? "conflict" : status >= 400 && status < 500 ? "invalid" : "unreachable";

/** Plain words for the backend's rule codes that the screens meet most. Others use the backend's own message. */
const FRIENDLY: Record<string, string> = {
  CREDIT_LIMIT_EXCEEDED: "This sale would take the shop over its credit limit. Take more cash now or ask your manager.",
  ANOTHER_PLAN_IN_PROGRESS: "You already have a day in progress. Finish it first.",
  DAY_PLAN_NOT_TODAY: "Only today's day plan can be started.",
  INVALID_CREDENTIALS: "That password is not right.",
};

const notAvailable = (what: string): never => {
  throw new ApiError("not_built_yet", `${what} is not available from the backend yet.`);
};

function query(q: Query = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Where an image the backend stored can be loaded from (the proxy adds the token). */
const fileUrl = (key: string | null | undefined) => (key ? `${BASE}/files/${key.split("/").map(encodeURIComponent).join("/")}` : undefined);

export function createHttpClient(viewer: Viewer): ApiClient {
  async function call<T = Wire>(method: string, path: string, opts: { q?: Query; json?: unknown; form?: FormData; key?: string } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.json !== undefined) headers["Content-Type"] = "application/json";
    if (opts.key) headers["Idempotency-Key"] = opts.key;
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}${query(opts.q)}`, { method, headers, body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined), credentials: "same-origin" });
    } catch {
      throw new ApiError("unreachable", "Network error");
    }
    if (res.status === 401) {
      // The session ended: back to the right login page, which says so.
      // A full page load on purpose: it drops every cached query of the ended session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login/${viewer.type}?ended=1`);
      throw new ApiError("forbidden", "Your session ended. Please sign in again.");
    }
    if (!res.ok) {
      let code = "";
      let message = "";
      try {
        const body = await res.json();
        code = body?.error?.code ?? "";
        message = body?.error?.message ?? "";
      } catch {
        /* not JSON */
      }
      if (res.status >= 500) throw new ApiError("unreachable", "Server error");
      throw new ApiError(STATUS_CODE(res.status), FRIENDLY[code] ?? (message || "The server refused this. Please check and try again."));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Every row of a backend list, a hundred at a time (up to `max`). */
  async function all(path: string, q: Query = {}, max = 2000): Promise<Wire[]> {
    const out: Wire[] = [];
    for (let page = 1; out.length < max; page++) {
      const r = await call<BackendPage>("GET", path, { q: { ...q, page, limit: PAGE_MAX } });
      out.push(...r.data);
      if (out.length >= r.total || r.data.length === 0) break;
    }
    return out;
  }

  /** One page as the screens ask for it (a page size above the backend's 100 is fetched in parts). */
  async function paged<T>(path: string, q: Query, pageQ: { page?: number; pageSize?: number }, map: (w: Wire) => T): Promise<Page<T>> {
    const pageSize = pageQ.pageSize ?? 25;
    const page = pageQ.page ?? 1;
    if (pageSize <= PAGE_MAX) {
      const r = await call<BackendPage>("GET", path, { q: { ...q, page, limit: pageSize } });
      return { items: r.data.map(map), total: r.total, page, pageSize };
    }
    const rows = await all(path, q, page * pageSize);
    const first = await call<BackendPage>("GET", path, { q: { ...q, page: 1, limit: 1 } });
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(map), total: first.total, page, pageSize };
  }

  // ---- lookups kept for a short while: products (for unit sizes) and routes (for shop routes)

  let productsAt = 0;
  let productsMemo: Promise<Map<Id, Wire>> | null = null;
  const products = () => {
    if (!productsMemo || Date.now() - productsAt > 30_000) {
      productsAt = Date.now();
      productsMemo = all("/products").then((rows) => new Map(rows.map((p) => [p.id, p])));
    }
    return productsMemo;
  };
  const toBase = (p: Wire | undefined, unit: string, quantity: number) => (unit === "carton" ? quantity * (p?.unitsPerCarton ?? 1) : quantity);

  let routesAt = 0;
  let routesMemo: Promise<Route[]> | null = null;
  const routes = (fresh = false) => {
    if (fresh || !routesMemo || Date.now() - routesAt > 30_000) {
      routesAt = Date.now();
      routesMemo = call<Wire[]>("GET", "/routes").then((rows) => Promise.all(rows.map((r) => call("GET", `/routes/${r.id}`).then(mapRoute))));
    }
    return routesMemo;
  };
  const routeOf = async (shopId: Id) => (await routes()).find((r) => r.shopIds.includes(shopId))?.id ?? null;

  // Images chosen on screen wait here until the record they belong to is sent (the backend takes
  // them in the same multipart request).
  const uploads = new Map<Id, Blob>();
  let uploadN = 0;

  // ---- shape adapters ----------------------------------------------------------------------------

  const mapBusiness = (b: Wire): Business => ({
    id: b.id,
    name: b.name,
    pan: b.panNumber ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    registrationNo: b.registrationNumber ?? "",
    logoImageId: b.logoKey ?? undefined,
    logoUrl: fileUrl(b.logoKey),
  });

  const mapStaff = (s: Wire): Staff => ({
    id: s.id,
    fullName: s.fullName,
    role: s.role,
    email: s.email,
    phone: s.phone ?? "",
    active: s.isActive,
    joinedOn: nepalDateOf(s.createdAt),
    lastLoginAt: s.lastLoginAt ?? undefined,
  });

  const mapProduct = (p: Wire): Product => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? "",
    categoryId: p.categoryId ?? "",
    unitName: p.unit,
    unitsPerCarton: p.unitsPerCarton ?? null,
    unitPricePaisa: p.pricePaisa,
    cartonPricePaisa: p.cartonPricePaisa ?? null,
    ...(p.costPricePaisa !== undefined ? { costPricePaisa: p.costPricePaisa ?? 0 } : {}),
    stockUnits: p.stockQuantity,
    lowStockUnits: p.lowStockAlert ?? 0,
    active: p.isActive,
    imageId: p.imageKey ?? undefined,
    imageUrl: fileUrl(p.imageKey),
  });

  function mapRoute(r: Wire): Route {
    return { id: r.id, name: r.name, shopIds: [...(r.clients ?? [])].sort((a: Wire, b: Wire) => a.sequence - b.sequence).map((c: Wire) => c.id) };
  }

  /** The backend keeps no "days until due" per shop; sales default to this many. */
  const DUE_DAYS = 7;

  const mapShop = (c: Wire, routeId: Id | null, balance?: Wire): ShopWithBalance => ({
    id: c.id,
    name: c.name,
    ownerName: c.ownerName ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    routeId,
    pan: c.panNumber ?? "",
    panImageId: c.panCardImageKey ?? undefined,
    panImageUrl: fileUrl(c.panCardImageKey),
    registrationNo: c.registrationNumber ?? "",
    latitude: c.lat ?? null,
    longitude: c.lng ?? null,
    creditLimitPaisa: c.creditLimitPaisa ?? balance?.creditLimitPaisa ?? 0,
    openingBalancePaisa: c.openingBalancePaisa ?? 0,
    dueDays: DUE_DAYS,
    active: c.isActive ?? true,
    hasLogin: Boolean(c.email),
    loginEmail: c.email ?? undefined,
    balancePaisa: balance?.balancePaisa ?? 0,
    inClearingPaisa: balance?.inClearingPaisa ?? 0,
    overduePaisa: balance?.overduePaisa ?? 0,
  });

  const withBalances = async (rows: Wire[]) => {
    const [rts, balances] = await Promise.all([routes(), Promise.all(rows.map((c) => call("GET", `/clients/${c.id}/balance`)))]);
    return rows.map((c, i) => mapShop(c, rts.find((r) => r.shopIds.includes(c.id))?.id ?? null, balances[i]));
  };

  const visitStatus = (s: string): Visit["status"] => (s === "planned" ? "pending" : (s as Visit["status"]));
  const mapVisit = (v: Wire): Visit => ({ id: v.id, shopId: v.client?.id ?? v.clientId, status: visitStatus(v.status), at: v.visitedAt ?? undefined, skipReason: v.status === "skipped" ? (v.note ?? undefined) : undefined });

  /** Stock lines (one per product and unit) added up per product in base units. */
  const sumLines = (stock: Wire[], field: "quantityIssued" | "quantityReturned" | "quantityCounted"): StockLine[] => {
    const by = new Map<Id, number>();
    for (const l of stock) if (l[field] !== null && l[field] !== undefined) by.set(l.product.id, (by.get(l.product.id) ?? 0) + toBase(l.product, l.unit, l[field]));
    return [...by].map(([productId, units]) => ({ productId, units }));
  };

  const mapPlan = (p: Wire): DayPlan => {
    const stock: Wire[] = p.stock ?? [];
    const closed = p.status === "closed" || p.status === "reconciled";
    return {
      id: p.id,
      date: p.planDate,
      salesmanId: p.salesman?.id,
      routeId: p.route?.id,
      status: p.status,
      issued: sumLines(stock, "quantityIssued"),
      visits: (p.visits ?? []).map(mapVisit),
      reportedUnsold: closed && stock.length ? sumLines(stock, "quantityReturned") : undefined,
      counted: p.status === "reconciled" && stock.length ? sumLines(stock, "quantityCounted") : undefined,
      reconcileNotes: p.note ?? undefined,
      createdAt: p.createdAt,
      startedAt: p.startedAt ?? undefined,
      closedAt: p.closedAt ?? undefined,
    };
  };

  /**
   * Our counts are base units per product; the backend wants one entry per (product, unit) line
   * on the plan. Cartons go on the carton line, the rest on the piece line (added if missing).
   */
  const splitToLines = (stock: Wire[], counts: StockLine[], field: "quantityReturned" | "quantityCounted") => {
    const out: Wire[] = [];
    for (const productId of new Set(stock.map((l) => l.product.id))) {
      const lines = stock.filter((l) => l.product.id === productId);
      let left = counts.find((c) => c.productId === productId)?.units ?? 0;
      const carton = lines.find((l) => l.unit === "carton");
      const upc = carton?.product.unitsPerCarton ?? 0;
      if (carton) {
        const n = upc > 0 && lines.some((l) => l.unit === "base") ? Math.floor(left / upc) : upc > 0 && left % upc === 0 ? left / upc : 0;
        out.push({ productId, unit: "carton", [field]: n });
        left -= n * upc;
      }
      if (lines.some((l) => l.unit === "base") || left > 0) out.push({ productId, unit: "base", [field]: left });
    }
    return out;
  };

  const lineOf = (items: Wire[], cat: Map<Id, Wire>): SaleLine[] =>
    items.map((i) => ({ productId: i.productId, quantity: i.quantity, unit: i.unit === "carton" ? "carton" : "unit", baseUnits: toBase(cat.get(i.productId), i.unit, i.quantity), pricePaisa: i.unitPricePaisa, totalPaisa: i.lineTotalPaisa }));

  const mapSale = (s: Wire, cat: Map<Id, Wire>): Sale => ({
    id: s.id,
    invoiceNo: s.invoiceNumber,
    date: s.saleDate,
    createdAt: s.createdAt,
    planId: s.dayPlanId ?? undefined,
    salesmanId: s.salesman?.id,
    shopId: s.client?.id,
    lines: lineOf(s.items ?? [], cat),
    totalPaisa: s.totalPaisa,
    dueDate: s.dueDate ?? s.saleDate,
    status: s.status,
    cancelReason: s.cancelReason ?? undefined,
    visitId: s.visitId ?? undefined,
    subtotalPaisa: s.subtotalPaisa ?? s.totalPaisa + (s.discountPaisa ?? 0),
    discountPaisa: s.discountPaisa ?? 0,
    paidPaisa: s.payments ? s.payments.filter((p: Wire) => p.status === "confirmed").reduce((a: number, p: Wire) => a + p.amountPaisa, 0) : undefined,
  });

  const mapPayment = (p: Wire): Payment => ({
    id: p.id,
    date: nepalDateOf(p.receivedAt ?? p.createdAt),
    createdAt: p.createdAt,
    shopId: p.client?.id,
    salesmanId: p.collectedBy?.id,
    planId: p.dayPlanId ?? undefined,
    saleId: p.saleId ?? undefined,
    method: p.method,
    amountPaisa: p.amountPaisa,
    status: p.status,
    chequeNo: p.chequeNumber ?? undefined,
    bank: p.chequeBank ?? undefined,
    chequeDate: p.chequeDate ?? undefined,
    reference: p.referenceNo ?? undefined,
    imageIds: (p.images ?? []).map((i: Wire) => i.imageKey),
    imageUrls: (p.images ?? []).map((i: Wire) => fileUrl(i.imageKey) ?? ""),
  });

  const mapReturn = (r: Wire, cat: Map<Id, Wire>): Return => ({
    id: r.id,
    date: r.returnDate,
    createdAt: r.createdAt,
    shopId: r.client?.id,
    salesmanId: r.receivedBy?.id,
    planId: r.dayPlanId ?? undefined,
    lines: (r.items ?? []).map((i: Wire) => ({ productId: i.productId, units: toBase(cat.get(i.productId), i.unit, i.quantity), reason: i.reason, restocked: Boolean(i.restocked), valuePaisa: i.lineTotalPaisa })),
    valuePaisa: r.totalPaisa,
  });

  const mapWriteOff = (w: Wire): WriteOff => ({
    id: w.id,
    date: w.writeOffDate,
    createdAt: w.createdAt,
    productId: w.product?.id,
    units: w.unit === "carton" ? w.quantity * (w.product?.unitsPerCarton ?? 1) : w.quantity,
    unit: w.unit === "carton" ? "carton" : "unit",
    quantity: w.quantity,
    reason: w.reason,
    note: w.note ?? "",
    planId: w.dayPlanId ?? undefined,
    createdBy: w.recordedBy?.id,
  });

  const toExpenseType = (t: ExpenseType) => (t === "misc" ? "miscellaneous" : t);
  const fromExpenseType = (t: string): ExpenseType => (t === "miscellaneous" ? "misc" : (t as ExpenseType));
  const mapExpense = (e: Wire): Expense => ({
    id: e.id,
    date: e.expenseDate,
    staffId: e.userId ?? e.recordedBy?.id,
    type: fromExpenseType(e.type),
    amountPaisa: e.amountPaisa,
    note: e.description ?? "",
    billImageId: e.receiptKey ?? undefined,
    billImageUrl: fileUrl(e.receiptKey),
    planId: e.dayPlanId ?? undefined,
    // Stored as the month's first day, "YYYY-MM-01".
    salaryMonth: e.forMonth ? String(e.forMonth).slice(0, 7) : undefined,
    createdBy: e.recordedBy?.id,
    createdAt: e.createdAt,
  });

  const FLAG: Record<string, PhotoFlag> = { no_exif: "no_photo_data", exif_old: "old_photo", too_far: "far_from_shop" };
  const mapPhoto = (p: Wire, extra: { planId?: Id; shopId?: Id; salesmanId?: Id } = {}): VisitPhoto => ({
    id: p.id,
    planId: p.dayPlanId ?? extra.planId,
    shopId: p.shop?.id ?? extra.shopId,
    salesmanId: p.salesman?.id ?? extra.salesmanId,
    takenAt: p.takenAt,
    deviceTakenAt: p.exifTakenAt ?? undefined,
    distanceM: p.distanceFromShopM ?? undefined,
    latitude: p.lat ?? undefined,
    longitude: p.lng ?? undefined,
    imageId: p.imageKey,
    imageUrl: fileUrl(p.imageKey),
    flags: (p.flagReason ? String(p.flagReason).split(",") : []).map((f: string) => FLAG[f]).filter(Boolean),
    visitId: p.visitId,
    note: p.note ?? undefined,
  });

  /** The backend's statement, with the balance carried in shown as the first line. */
  const mapStatement = (s: Wire, from?: BusinessDate): StatementEntry[] => {
    const opening = s.openingBalancePaisa as number;
    const first = from ?? s.entries[0]?.date ?? todayNepal();
    return [
      { date: first, kind: "opening", ref: "Opening balance", debitPaisa: Math.max(0, opening), creditPaisa: Math.max(0, -opening), balancePaisa: opening },
      ...s.entries.map((e: Wire) => ({
        date: e.date,
        kind: e.type,
        ref: e.type === "sale" ? String(e.reference).replace("Invoice #", "Invoice ") : e.type === "payment" ? `${e.reference} payment` : e.reference,
        debitPaisa: e.debitPaisa,
        creditPaisa: e.creditPaisa,
        balancePaisa: e.balancePaisa,
      })),
    ];
  };

  /** An invoice as the shop sees it (from the shop's own calls: no ids beyond its own). */
  const mapShopInvoice = (s: Wire): ShopInvoice => ({
    id: s.id,
    invoiceNo: s.invoiceNumber,
    date: s.saleDate,
    createdAt: s.createdAt,
    dueDate: s.dueDate ?? s.saleDate,
    status: s.status,
    lines: (s.items ?? []).map((i: Wire) => ({ productName: i.productName, unitName: i.baseUnit ?? "unit", unit: i.unit === "carton" ? "carton" : "unit", quantity: i.quantity, pricePaisa: i.unitPricePaisa, totalPaisa: i.lineTotalPaisa })),
    subtotalPaisa: s.subtotalPaisa,
    discountPaisa: s.discountPaisa ?? 0,
    totalPaisa: s.totalPaisa,
    paidPaisa: s.paidPaisa ?? 0,
    salesmanName: s.salesman?.fullName ?? "Your salesman",
    cancelReason: s.cancelReason ?? undefined,
    payments: s.payments?.map((p: Wire) => ({ date: nepalDateOf(p.receivedAt), method: p.method, amountPaisa: p.amountPaisa, status: p.status })),
  });

  // ---- visits: the backend has no GET /visits/:id, so a visit is found on the salesman's plans

  async function findVisit(visitId: Id): Promise<VisitShop> {
    const plans = await call<Wire[]>("GET", "/day-plans/today");
    const plan = plans.find((p) => (p.visits ?? []).some((v: Wire) => v.id === visitId));
    if (!plan) throw new ApiError("not_found", "This visit is not on any of today's day plans.");
    const [stops, client, balance, sold] = await Promise.all([
      call<Wire[]>("GET", `/day-plans/${plan.id}/shops`),
      call("GET", `/clients/${plan.visits.find((v: Wire) => v.id === visitId).client.id}`),
      call("GET", `/clients/${plan.visits.find((v: Wire) => v.id === visitId).client.id}/balance`),
      all("/sales", { dayPlanId: plan.id, status: "confirmed" }),
    ]);
    const stop = stops.find((s) => s.visit.id === visitId)!;
    return {
      visit: mapVisit({ ...stop.visit, client: { id: stop.shop.id } }),
      planId: plan.id,
      planStatus: plan.status,
      position: stop.visit.sequence + 1, // the backend counts stops from 0
      shop: mapShop(client, await routeOf(client.id), balance),
      todayPurchasesPaisa: stop.purchasedOnPlanPaisa ?? 0,
      todaySalesCount: sold.filter((s) => s.client?.id === client.id).length,
    };
  }

  const planStock = async (planId: Id) => ((await call("GET", `/day-plans/${planId}`)).stock ?? []) as Wire[];

  // ---- the client ---------------------------------------------------------------------------------

  return {
    viewer,

    business: {
      get: async () => mapBusiness(await call("GET", "/business")),
      update: async (input) => {
        if (input.logoImageId) notAvailable("Uploading a logo");
        const body: Wire = { name: input.name, phone: input.phone, email: input.email, address: input.address, city: input.city, registrationNumber: input.registrationNo };
        if (input.logoImageId === null) body.logoKey = null;
        return mapBusiness(await call("PATCH", "/business", { json: body }));
      },
    },

    staff: {
      list: async (f = {}) => {
        const rows = (await all("/staff", { role: f.role, isActive: f.active })).map(mapStaff);
        const term = f.search?.trim().toLowerCase();
        return term ? rows.filter((s) => `${s.fullName} ${s.email} ${s.phone}`.toLowerCase().includes(term)) : rows;
      },
      get: async (id) => mapStaff(await call("GET", `/staff/${id}`)),
      create: async (i) => mapStaff(await call("POST", "/staff", { json: { fullName: i.fullName, email: i.email, phone: i.phone || undefined, role: i.role, password: i.temporaryPassword } })),
      update: async (id, i) => mapStaff(await call("PATCH", `/staff/${id}`, { json: { fullName: i.fullName, email: i.email, phone: i.phone, role: i.role, isActive: i.active } })),
      resetPassword: async (id, temporaryPassword) => void (await call("POST", `/staff/${id}/reset-password`, { json: { temporaryPassword } })),
    },

    uploads: {
      image: async (file) => {
        const id = `local-${++uploadN}`;
        uploads.set(id, file);
        return { id, url: URL.createObjectURL(file) };
      },
    },

    categories: {
      list: async () => {
        const [cats, prods] = await Promise.all([call<Wire[]>("GET", "/product-categories"), products()]);
        return cats.map((c) => ({ id: c.id, name: c.name, productCount: [...prods.values()].filter((p) => p.categoryId === c.id).length }));
      },
      create: async (name) => {
        const c = await call("POST", "/product-categories", { json: { name } });
        return { id: c.id, name: c.name, productCount: 0 };
      },
      rename: async (id, name) => {
        const c = await call("PATCH", `/product-categories/${id}`, { json: { name } });
        return { id: c.id, name: c.name, productCount: [...(await products()).values()].filter((p) => p.categoryId === id).length };
      },
      remove: async (id) => void (await call("DELETE", `/product-categories/${id}`)),
    },

    products: {
      list: async (q = {}) => {
        const filter = { search: q.search, categoryId: q.categoryId, isActive: q.active };
        if (!q.lowStock) return paged("/products", filter, q, mapProduct);
        const rows = (await all("/products", filter)).map(mapProduct).filter((p) => p.stockUnits <= p.lowStockUnits);
        const size = q.pageSize ?? 25;
        const page = q.page ?? 1;
        return { items: rows.slice((page - 1) * size, page * size), total: rows.length, page, pageSize: size };
      },
      get: async (id) => mapProduct(await call("GET", `/products/${id}`)),
      create: async (i) => {
        if (i.imageId) notAvailable("Uploading a product photo");
        productsMemo = null;
        return mapProduct(
          await call("POST", "/products", {
            json: { name: i.name, sku: i.sku || undefined, categoryId: i.categoryId || undefined, unit: i.unitName, unitsPerCarton: i.unitsPerCarton, pricePaisa: i.unitPricePaisa, cartonPricePaisa: i.cartonPricePaisa, costPricePaisa: i.costPricePaisa, lowStockAlert: i.lowStockUnits, isActive: i.active, stockQuantity: i.stockUnits },
          }),
        );
      },
      update: async (id, i) => {
        if (i.imageId) notAvailable("Uploading a product photo");
        productsMemo = null;
        const body: Wire = { name: i.name, sku: i.sku, categoryId: i.categoryId, unit: i.unitName, unitsPerCarton: i.unitsPerCarton, pricePaisa: i.unitPricePaisa, cartonPricePaisa: i.cartonPricePaisa, costPricePaisa: i.costPricePaisa, lowStockAlert: i.lowStockUnits, isActive: i.active };
        if (i.imageId === null) body.imageKey = null;
        return mapProduct(await call("PATCH", `/products/${id}`, { json: body }));
      },
      adjustStock: async (id, delta) => {
        productsMemo = null;
        return mapProduct(await call("POST", `/products/${id}/stock-adjust`, { json: { delta } }));
      },
    },

    routes: {
      list: () => routes(true),
      get: async (id) => mapRoute(await call("GET", `/routes/${id}`)),
      create: async (i) => {
        const r = await call("POST", "/routes", { json: { name: i.name } });
        routesMemo = null;
        return { id: r.id, name: r.name, shopIds: [] };
      },
      update: async (id, i) => {
        await call("PATCH", `/routes/${id}`, { json: { name: i.name } });
        routesMemo = null;
        return mapRoute(await call("GET", `/routes/${id}`));
      },
      remove: async () => notAvailable("Deleting a route"),
      setShops: async (id, shopIds) => {
        await call("PUT", `/routes/${id}/clients`, { json: { clientIds: shopIds } });
        routesMemo = null;
        return mapRoute(await call("GET", `/routes/${id}`));
      },
    },

    shops: {
      list: async (q = {}) => {
        const routeId = q.routeId && q.routeId !== "none" ? q.routeId : undefined;
        let rows = await all("/clients", { search: q.search, routeId, isActive: q.active });
        if (q.routeId === "none") {
          const onRoute = new Set((await routes()).flatMap((r) => r.shopIds));
          rows = rows.filter((c) => !onRoute.has(c.id));
        }
        let shops = await withBalances(rows);
        if (q.overdue) shops = shops.filter((s) => s.overduePaisa > 0);
        const size = q.pageSize ?? 25;
        const page = q.page ?? 1;
        return { items: shops.slice((page - 1) * size, page * size), total: shops.length, page, pageSize: size };
      },
      get: async (id) => (await withBalances([await call("GET", `/clients/${id}`)]))[0],
      create: async (i) => {
        if (!i.loginEmail || !i.temporaryPassword) throw new ApiError("invalid", "The backend needs a sign-in email and a temporary password for every new shop.");
        if (i.panImageId) notAvailable("Uploading a PAN card photo");
        const c = await call("POST", "/clients", {
          json: { name: i.name, email: i.loginEmail, password: i.temporaryPassword, ownerName: i.ownerName || undefined, phone: i.phone || undefined, address: i.address || undefined, panNumber: i.pan || undefined, registrationNumber: i.registrationNo || undefined, lat: i.latitude ?? undefined, lng: i.longitude ?? undefined, creditLimitPaisa: i.creditLimitPaisa, openingBalancePaisa: i.openingBalancePaisa },
        });
        if (i.routeId) {
          const r = await call("GET", `/routes/${i.routeId}`);
          await call("PUT", `/routes/${i.routeId}/clients`, { json: { clientIds: [...mapRoute(r).shopIds, c.id] } });
          routesMemo = null;
        }
        return (await withBalances([c]))[0];
      },
      update: async (id, i) => {
        if (i.panImageId) notAvailable("Uploading a PAN card photo");
        const body: Wire = { name: i.name, ownerName: i.ownerName, phone: i.phone, address: i.address, panNumber: i.pan === "" ? null : i.pan, registrationNumber: i.registrationNo === "" ? null : i.registrationNo, lat: i.latitude, lng: i.longitude, creditLimitPaisa: i.creditLimitPaisa, openingBalancePaisa: i.openingBalancePaisa, isActive: i.active, email: i.loginEmail };
        if (i.panImageId === null) body.panCardImageKey = null;
        const c = await call("PATCH", `/clients/${id}`, { json: body });
        if (i.temporaryPassword) await call("POST", `/clients/${id}/reset-password`, { json: { temporaryPassword: i.temporaryPassword } });
        if (i.routeId !== undefined) {
          const rts = await routes(true);
          const from = rts.find((r) => r.shopIds.includes(id));
          if (from?.id !== (i.routeId ?? undefined)) {
            if (from) await call("PUT", `/routes/${from.id}/clients`, { json: { clientIds: from.shopIds.filter((s) => s !== id) } });
            const to = rts.find((r) => r.id === i.routeId);
            if (to) await call("PUT", `/routes/${to.id}/clients`, { json: { clientIds: [...to.shopIds, id] } });
            routesMemo = null;
          }
        }
        return (await withBalances([c]))[0];
      },
      resetPassword: async (id, temporaryPassword) => void (await call("POST", `/clients/${id}/reset-password`, { json: { temporaryPassword } })),
      balance: async (id) => {
        const b = await call("GET", `/clients/${id}/balance`);
        return { openingPaisa: b.openingBalancePaisa, salesPaisa: b.totalSalesPaisa, paymentsPaisa: b.totalPaymentsPaisa, returnsPaisa: b.totalReturnsPaisa, balancePaisa: b.balancePaisa, inClearingPaisa: b.inClearingPaisa, overduePaisa: b.overduePaisa, creditLimitPaisa: b.creditLimitPaisa, creditUsedPaisa: b.owedPaisa };
      },
      statement: async (id, range = {}) => mapStatement(await call("GET", `/clients/${id}/statement`, { q: { from: range.from, to: range.to } }), range.from),
      itemsTaken: async (id) => {
        const [rows, cat] = await Promise.all([call<Wire[]>("GET", `/clients/${id}/items-taken`), products()]);
        return rows.map((r) => ({ productId: r.productId, unit: r.unit === "carton" ? "carton" : "unit", quantity: r.quantity, baseUnits: toBase(cat.get(r.productId), r.unit, r.quantity), totalPaisa: r.totalPaisa }));
      },
      // No "returnable" call yet: what the shop bought, in base units. The backend still checks.
      returnable: async (id) => {
        const [rows, cat] = await Promise.all([call<Wire[]>("GET", `/clients/${id}/items-taken`), products()]);
        const by = new Map<Id, number>();
        for (const r of rows) by.set(r.productId, (by.get(r.productId) ?? 0) + toBase(cat.get(r.productId), r.unit, r.quantity));
        return [...by].map(([productId, units]) => ({ productId, units }));
      },
    },

    dayPlans: {
      list: async (f = {}) => {
        const date = f.from && f.from === f.to ? f.from : undefined;
        const q = { date, salesmanId: f.salesmanId, status: f.status };
        if (date || (!f.from && !f.to)) return paged("/day-plans", q, f, mapPlan);
        const rows = (await all("/day-plans", q)).filter((p) => (!f.from || p.planDate >= f.from) && (!f.to || p.planDate <= f.to));
        const size = f.pageSize ?? 25;
        const page = f.page ?? 1;
        return { items: rows.slice((page - 1) * size, page * size).map(mapPlan), total: rows.length, page, pageSize: size };
      },
      get: async (id) => mapPlan(await call("GET", `/day-plans/${id}`)),
      today: async () => {
        const plans = await call<Wire[]>("GET", "/day-plans/today");
        const plan = plans.find((p) => p.status === "in_progress") ?? plans[0];
        return plan ? mapPlan(plan) : null;
      },
      create: async (i) =>
        mapPlan(await call("POST", "/day-plans", { json: { salesmanId: i.salesmanId, routeId: i.routeId, planDate: i.date, stock: i.lines.map((l) => ({ productId: l.productId, unit: l.unit === "carton" ? "carton" : "base", quantity: l.quantity })) } })),
      remove: async (id) => void (await call("DELETE", `/day-plans/${id}`)),
      start: async (id) => mapPlan(await call("POST", `/day-plans/${id}/start`)),
      shops: async (id) => {
        const [plan, stops, sold] = await Promise.all([call("GET", `/day-plans/${id}`), call<Wire[]>("GET", `/day-plans/${id}/shops`), all("/sales", { dayPlanId: id, status: "confirmed" })]);
        const rts = await routes();
        return stops.map((s) => ({
          visit: mapVisit({ ...s.visit, client: { id: s.shop.id } }),
          planId: id,
          planStatus: plan.status as DayPlanStatus,
          position: s.visit.sequence + 1,
          shop: mapShop(s.shop, rts.find((r) => r.shopIds.includes(s.shop.id))?.id ?? null, { balancePaisa: s.balancePaisa }),
          todayPurchasesPaisa: s.purchasedOnPlanPaisa ?? 0,
          todaySalesCount: sold.filter((x) => x.client?.id === s.shop.id).length,
        }));
      },
      addVisit: async (id, shopId) => {
        const v = await call("POST", `/day-plans/${id}/visits`, { json: { clientId: shopId } });
        return findVisit(v.id);
      },
      close: async (id, i) => {
        const stock = await planStock(id);
        await call("POST", `/day-plans/${id}/close`, { json: { cashHandedOverPaisa: i.cashHandedOverPaisa, returned: splitToLines(stock, i.reportedUnsold, "quantityReturned") } });
        return mapPlan(await call("GET", `/day-plans/${id}`));
      },
      // The backend has no separate manager count of cash: it compares the cash handed over.
      reconcile: async (id, i) => {
        const stock = await planStock(id);
        await call("POST", `/day-plans/${id}/reconcile`, { json: { counted: splitToLines(stock, i.counted, "quantityCounted"), note: i.notes || undefined } });
        return mapPlan(await call("GET", `/day-plans/${id}`));
      },
      report: async (id): Promise<DayReport> => {
        const [plan, r, sold, paid] = await Promise.all([call("GET", `/day-plans/${id}`), call("GET", `/day-plans/${id}/report`), all("/sales", { dayPlanId: id }), all("/payments", { dayPlanId: id })]);
        const confirmed = sold.filter((s) => s.status === "confirmed");
        const mapped = mapPlan(plan);
        const methods: PaymentMethod[] = ["cash", "cheque", "online"];
        return {
          plan: { ...mapped, cashHandedOverPaisa: r.cashHandedOverPaisa ?? undefined, cashCountedPaisa: r.status === "reconciled" ? (r.cashHandedOverPaisa ?? undefined) : undefined, reconciledBy: r.reconciledBy ?? undefined, reconciledAt: r.reconciledAt ?? undefined },
          stock: r.products.map((p: Wire) => ({ productId: p.product.id, issued: p.issued, sold: p.sold, remaining: p.issued - p.sold - p.writtenOff, reportedUnsold: p.returned, counted: p.counted, writtenOff: p.writtenOff, shortage: p.shortage ?? null })),
          cash: { collectedPaisa: r.cash.expectedPaisa, handedOverPaisa: r.cash.handedOverPaisa, countedPaisa: r.status === "reconciled" ? r.cash.handedOverPaisa : null, differencePaisa: r.cash.differencePaisa },
          sales: { count: confirmed.length, totalPaisa: confirmed.reduce((a, s) => a + s.totalPaisa, 0) },
          payments: methods
            .map((method) => {
              const of = paid.filter((p) => p.method === method && p.status !== "bounced");
              return { method, count: of.length, amountPaisa: of.reduce((a, p) => a + p.amountPaisa, 0), pendingCount: of.filter((p) => p.status === "pending").length };
            })
            .filter((x) => x.count > 0),
          visits: { visited: mapped.visits.filter((v) => v.status === "visited").length, skipped: mapped.visits.filter((v) => v.status === "skipped").length, pending: mapped.visits.filter((v) => v.status === "pending").length },
        };
      },
    },

    visits: {
      get: findVisit,
      update: async (id, i) => {
        await call("PATCH", `/visits/${id}`, { json: { status: i.status, note: i.skipReason || undefined } });
        return findVisit(id);
      },
    },

    sales: {
      list: async (f = {}) => {
        const cat = await products();
        return paged("/sales", { from: f.from, to: f.to, salesmanId: f.salesmanId, clientId: f.shopId, dayPlanId: f.planId, status: f.status }, f, (s) => mapSale(s, cat));
      },
      get: async (id) => mapSale(await call("GET", `/sales/${id}`), await products()),
      create: async (i) => {
        const v = await findVisit(i.visitId);
        const s = await call("POST", "/sales", {
          key: i.idempotencyKey,
          json: { clientId: v.shop.id, visitId: i.visitId, dayPlanId: v.planId, dueDate: i.dueDate, discountPaisa: i.discountPaisa, cashPaidNowPaisa: i.cashPaidPaisa, items: i.lines.map((l) => ({ productId: l.productId, unit: l.unit === "carton" ? "carton" : "base", quantity: l.quantity })) },
        });
        return { ...mapSale(s, await products()), cashPaidPaisa: i.cashPaidPaisa };
      },
      cancel: async (id, reason) => {
        await call("POST", `/sales/${id}/cancel`, { json: { reason } });
        return mapSale(await call("GET", `/sales/${id}`), await products());
      },
    },

    payments: {
      list: async (f = {}) => paged("/payments", { from: f.from, to: f.to, clientId: f.shopId, collectedBy: f.salesmanId, dayPlanId: f.planId, saleId: f.saleId, method: f.method, status: f.status }, f, mapPayment),
      get: async (id) => mapPayment(await call("GET", `/payments/${id}`)),
      create: async (i) => {
        const v = await findVisit(i.visitId);
        const fields: Wire = { clientId: v.shop.id, dayPlanId: v.planId, saleId: i.saleId, method: i.method, amountPaisa: i.amountPaisa, chequeNumber: i.chequeNo, chequeBank: i.bank, chequeDate: i.chequeDate, referenceNo: i.reference };
        const images = i.imageIds.map((id) => uploads.get(id)).filter((b): b is Blob => Boolean(b));
        if (!images.length) return mapPayment(await call("POST", "/payments", { key: i.idempotencyKey, json: fields }));
        const form = new FormData();
        for (const [k, val] of Object.entries(fields)) if (val !== undefined && val !== null && val !== "") form.set(k, String(val));
        const kinds = i.method === "cheque" ? ["cheque_front", "cheque_back"] : ["online_screenshot", "other"];
        images.forEach((b, n) => form.append(kinds[Math.min(n, kinds.length - 1)], b, `image-${n + 1}.jpg`));
        const p = await call("POST", "/payments", { key: i.idempotencyKey, form });
        i.imageIds.forEach((id) => uploads.delete(id));
        return mapPayment(p);
      },
      decide: async (id, status) => mapPayment(await call("PATCH", `/payments/${id}/status`, { json: { status } })),
    },

    returns: {
      list: async (f = {}) => {
        const cat = await products();
        return paged("/returns", { from: f.from, to: f.to, clientId: f.shopId, receivedBy: f.salesmanId }, f, (r) => mapReturn(r, cat));
      },
      get: async (id) => mapReturn(await call("GET", `/returns/${id}`), await products()),
      create: async (i) => {
        const v = i.visitId ? await findVisit(i.visitId) : null;
        const r = await call("POST", "/returns", {
          json: {
            clientId: v?.shop.id ?? i.shopId,
            dayPlanId: v?.planId,
            items: i.lines.map((l) => ({ productId: l.productId, unit: "base", quantity: l.units, reason: l.reason, restocked: l.restock, ...(l.valuePaisa !== undefined && l.units > 0 ? { unitPricePaisa: Math.round(l.valuePaisa / l.units) } : {}) })),
          },
        });
        return mapReturn(r, await products());
      },
    },

    writeOffs: {
      list: async (f = {}) => paged("/write-offs", { from: f.from, to: f.to }, f, mapWriteOff),
      create: async (i) => mapWriteOff(await call("POST", "/write-offs", { json: { productId: i.productId, unit: i.unit === "carton" ? "carton" : "base", quantity: i.quantity, reason: i.reason, dayPlanId: i.planId, note: i.note || undefined } })),
    },

    expenses: {
      list: async (f = {}) => paged("/expenses", { from: f.from, to: f.to, type: f.type ? toExpenseType(f.type) : undefined, userId: f.staffId }, f, mapExpense),
      // No GET /expenses/:id yet: look through the most recent expenses.
      get: async (id) => {
        const found = (await all("/expenses", {}, 1000)).find((e) => e.id === id);
        if (!found) throw new ApiError("not_found", "This expense was not found.");
        return mapExpense(found);
      },
      create: async (i) => {
        const fields: Wire = { type: toExpenseType(i.type), amountPaisa: i.amountPaisa, expenseDate: i.date, userId: i.staffId, dayPlanId: i.planId, forMonth: i.salaryMonth, description: i.note || undefined };
        const bill = i.billImageId ? uploads.get(i.billImageId) : undefined;
        if (!bill) return mapExpense(await call("POST", "/expenses", { json: fields }));
        const form = new FormData();
        for (const [k, val] of Object.entries(fields)) if (val !== undefined && val !== null && val !== "") form.set(k, String(val));
        form.append("receipt", bill, "receipt.jpg");
        const e = await call("POST", "/expenses", { form });
        uploads.delete(i.billImageId!);
        return mapExpense(e);
      },
      update: async (id, p) => {
        if (p.billImageId) notAvailable("Changing a bill photo");
        return mapExpense(
          await call("PATCH", `/expenses/${id}`, { json: { type: p.type ? toExpenseType(p.type) : undefined, amountPaisa: p.amountPaisa, expenseDate: p.date, userId: p.staffId, dayPlanId: p.planId, forMonth: p.salaryMonth, description: p.note } }),
        );
      },
      summary: async (f) => {
        if (f.staffId || f.type) {
          const rows = (await all("/expenses", { from: f.from, to: f.to, type: f.type ? toExpenseType(f.type) : undefined, userId: f.staffId })).map(mapExpense);
          return expenseSummary(rows, f);
        }
        const s = await call("GET", "/expenses/summary", { q: { from: f.from, to: f.to } });
        return {
          from: s.from,
          to: s.to,
          totalPaisa: s.totalPaisa,
          count: s.byType.reduce((a: number, t: Wire) => a + t.count, 0),
          byType: s.byType.map((t: Wire) => ({ type: fromExpenseType(t.type), count: t.count, amountPaisa: t.totalPaisa })),
          byMonth: s.byMonth.map((m: Wire) => ({ month: m.month, totalPaisa: m.totalPaisa, byType: { salary: m.byType.salary ?? 0, fuel: m.byType.fuel ?? 0, khaja: m.byType.khaja ?? 0, misc: m.byType.miscellaneous ?? 0 } })),
        };
      },
    },

    photos: {
      list: async (f = {}) => {
        const date = f.from && f.from === f.to ? f.from : undefined;
        const q = { date, salesmanId: f.salesmanId, dayPlanId: f.planId, flagged: f.flagged || undefined };
        if (date || (!f.from && !f.to)) return paged("/visit-photos", q, f, (p) => mapPhoto(p));
        const rows = (await all("/visit-photos", q, 1000)).filter((p) => {
          const d = nepalDateOf(p.takenAt);
          return (!f.from || d >= f.from) && (!f.to || d <= f.to);
        });
        const size = f.pageSize ?? 25;
        return { items: rows.slice(0, size).map((p) => mapPhoto(p)), total: rows.length, page: 1, pageSize: size };
      },
      get: async () => notAvailable("Opening one visit photo"),
      create: async (i) => {
        const v = await findVisit(i.visitId);
        const blob = uploads.get(i.imageId);
        if (!blob) throw new ApiError("invalid", "Take the photo again.");
        const form = new FormData();
        form.append("photo", blob, "visit.jpg");
        if (i.latitude !== undefined && i.longitude !== undefined) {
          form.set("lat", String(i.latitude));
          form.set("lng", String(i.longitude));
        }
        if (i.note) form.set("note", i.note);
        const p = await call("POST", `/visits/${i.visitId}/photos`, { form });
        uploads.delete(i.imageId);
        return mapPhoto(p, { planId: v.planId, shopId: v.shop.id, salesmanId: viewer.id });
      },
    },

    reports: {
      // Put together from the calls the backend has; it has no single dashboard call yet.
      dashboard: async () => {
        const day = todayNepal();
        const [today, pending, plans, flagged, overdue, low, shops] = await Promise.all([
          call("GET", "/reports/today"),
          call<BackendPage>("GET", "/payments", { q: { status: "pending", limit: 1 } }),
          all("/day-plans", { date: day }),
          call<BackendPage>("GET", "/visit-photos", { q: { flagged: true, limit: 1 } }),
          all("/reports/overdue-credit"),
          call<BackendPage>("GET", "/reports/low-stock", { q: { limit: 1 } }),
          all("/clients"),
        ]);
        const plansByStatus = { planned: 0, in_progress: 0, closed: 0, reconciled: 0 };
        for (const p of plans) plansByStatus[p.status as DayPlanStatus]++;
        const balances = await Promise.all(shops.map((c) => call("GET", `/clients/${c.id}/balance`)));
        return {
          date: day,
          salesTodayPaisa: today.salesPaisa,
          salesTodayCount: today.salesCount,
          collectedTodayPaisa: today.cashCollectedPaisa,
          cashTodayPaisa: today.cashCollectedPaisa,
          pendingPaymentCount: pending.total,
          inClearingPaisa: balances.reduce((a, b) => a + (b.inClearingPaisa ?? 0), 0),
          overduePaisa: overdue.reduce((a, o) => a + o.overduePaisa, 0),
          overdueShopCount: overdue.length,
          lowStockCount: low.total,
          plansByStatus,
          flaggedPhotoCount: flagged.total,
        };
      },
      salesByDay: async (range) => {
        const rows = await all("/sales", { from: range.from, to: range.to, status: "confirmed" }, 5000);
        const by = new Map<string, { totalPaisa: number; count: number }>();
        for (const s of rows) {
          const d = by.get(s.saleDate) ?? { totalPaisa: 0, count: 0 };
          d.totalPaisa += s.totalPaisa;
          d.count++;
          by.set(s.saleDate, d);
        }
        return [...by].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
      },
      salesBySalesman: async (range) => {
        const rows = await all("/sales", { from: range.from, to: range.to, status: "confirmed" }, 5000);
        const by = new Map<string, { totalPaisa: number; count: number }>();
        for (const s of rows) {
          const d = by.get(s.salesman.id) ?? { totalPaisa: 0, count: 0 };
          d.totalPaisa += s.totalPaisa;
          d.count++;
          by.set(s.salesman.id, d);
        }
        return [...by].map(([salesmanId, v]) => ({ salesmanId, ...v }));
      },
      overdue: async () => (await all("/reports/overdue-credit")).map((o) => ({ shopId: o.shop.id, overduePaisa: o.overduePaisa, oldestDueDate: o.oldestDueDate })),
      // No sales-per-product call for a date range yet, so "sold" is left out.
      lowStock: async () => (await all("/reports/low-stock")).map((p) => ({ ...mapProduct({ ...p, isActive: true, pricePaisa: 0, categoryId: "" }), soldUnits: undefined })),
      today: async (range) => {
        const day = todayNepal();
        if (!range || (range.from === day && range.to === day)) {
          const t = await call("GET", "/reports/today");
          return {
            date: t.date,
            from: t.date,
            to: t.date,
            count: t.salesCount,
            totalPaisa: t.salesPaisa,
            cashCollectedPaisa: t.cashCollectedPaisa,
            byShop: t.shops.map((s: Wire) => ({ shopId: s.shop.id, count: s.salesCount, totalPaisa: s.salesPaisa, cashPaisa: s.cashCollectedPaisa })),
            bySalesman: (t.salesmen ?? (viewer.type === "staff" ? [{ salesman: { id: viewer.id }, ...t }] : [])).map((s: Wire) => ({ salesmanId: s.salesman?.id ?? "office", count: s.salesCount, totalPaisa: s.salesPaisa, cashPaisa: s.cashCollectedPaisa })),
          };
        }
        // Other dates: worked out here from the sales and payments in the range.
        const cat = await products();
        const [sold, paid] = await Promise.all([all("/sales", { from: range.from, to: range.to }, 5000), all("/payments", { from: range.from, to: range.to, method: "cash" }, 5000)]);
        return salesInRange(range, sold.map((s) => mapSale(s, cat)), paid.map(mapPayment));
      },
      salesmanAnalytics: async (id, range) => {
        const [a, spent] = await Promise.all([call("GET", `/reports/salesman/${id}/analytics`, { q: { from: range.from, to: range.to } }), all("/expenses", { from: range.from, to: range.to, userId: id })]);
        return {
          from: a.from,
          to: a.to,
          sales: { count: a.sales.count, totalPaisa: a.sales.totalPaisa },
          // The backend gives the pending amount per method, not a count.
          payments: a.payments.byMethod.filter((m: Wire) => m.count > 0).map((m: Wire) => ({ method: m.method, count: m.count, amountPaisa: m.totalPaisa, pendingCount: 0 })),
          perDay: a.days.map((d: Wire) => ({ date: d.date, count: d.salesCount, totalPaisa: d.salesPaisa })),
          perShop: a.shops.map((s: Wire) => ({ shopId: s.shop.id, count: s.salesCount, totalPaisa: s.salesPaisa })),
          topProducts: a.topProducts.map((p: Wire) => ({ productId: p.product.id, baseUnits: p.quantity, totalPaisa: p.salesPaisa })),
          returnsPaisa: a.returns.totalPaisa,
          expensesPaisa: spent.reduce((n, e) => n + e.amountPaisa, 0),
          shortage: { plans: a.shortage.plans, units: a.shortage.units, valuePaisa: a.shortage.valuePaisa, byProduct: [] },
        };
      },
      salesmanHistory: async (id, range) => {
        const METHOD = { cash: "Cash", cheque: "Cheque", online: "Online" } as Record<string, string>;
        const rows = await all(`/reports/salesman/${id}/history`, { from: range.from, to: range.to }, 5000);
        return rows.map((r) => ({ kind: r.kind, id: r.id, date: r.date, at: r.at, shopId: r.shop.id, amountPaisa: r.amountPaisa, status: r.status, ref: r.kind === "sale" ? `Invoice ${r.invoiceNumber}` : (METHOD[r.method] ?? r.method) }));
      },
    },

    shopPortal: {
      me: async () => {
        const s = await call("GET", "/shop/me");
        return {
          shopName: s.name,
          ownerName: s.ownerName ?? "",
          phone: s.phone ?? "",
          address: s.address ?? "",
          pan: s.panNumber ?? "",
          registrationNo: s.registrationNumber ?? "",
          loginEmail: s.email ?? undefined,
          // A shop sees only its supplier's name from the backend.
          business: { name: s.business?.name ?? "", address: "", city: "", phone: "", pan: "" },
        };
      },
      summary: async () => {
        const [s, b, recent] = await Promise.all([call("GET", "/shop/me"), call("GET", "/shop/me/balance"), call<BackendPage>("GET", "/shop/me/payments", { q: { limit: 10 } })]);
        const last = recent.data.find((p) => p.status !== "bounced");
        return {
          shopName: s.name,
          businessName: s.business?.name ?? "",
          balancePaisa: b.balancePaisa,
          inClearingPaisa: b.inClearingPaisa,
          creditLimitPaisa: b.creditLimitPaisa,
          creditUsedPaisa: b.owedPaisa,
          overduePaisa: b.overduePaisa,
          oldestOverdueDate: b.overdueSales?.[0]?.dueDate,
          lastPayment: last ? { date: nepalDateOf(last.receivedAt), amountPaisa: last.amountPaisa, method: last.method, status: last.status } : undefined,
        };
      },
      statement: async (range = {}) => mapStatement(await call("GET", "/shop/me/statement", { q: { from: range.from, to: range.to } }), range.from),
      invoices: async (q = {}) => paged("/shop/me/invoices", { from: q.from, to: q.to, status: q.status }, q, mapShopInvoice),
      invoice: async (id) => mapShopInvoice(await call("GET", `/shop/me/invoices/${id}`)),
      payments: async (q = {}) =>
        paged("/shop/me/payments", { from: q.from, to: q.to, status: q.status }, q, (p) => ({
          id: p.id,
          date: nepalDateOf(p.receivedAt),
          method: p.method,
          amountPaisa: p.amountPaisa,
          status: p.status,
          chequeNo: p.chequeNumber ?? undefined,
          bank: p.chequeBank ?? undefined,
          reference: p.referenceNo ?? undefined,
          invoiceNo: p.invoiceNumber ?? undefined,
        })),
      returns: async (q = {}) =>
        paged("/shop/me/returns", { from: q.from, to: q.to }, q, (r) => ({
          id: r.id,
          date: r.returnDate,
          valuePaisa: r.totalPaisa,
          // Lines are counted in what was returned: pieces, or cartons shown as such.
          lines: (r.items ?? []).map((i: Wire) => ({ productName: i.productName, unitName: i.unit === "carton" ? "carton" : (i.baseUnit ?? "unit"), units: i.quantity, reason: i.reason })),
        })),
    },
  };
}
