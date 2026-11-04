// The business rules, as pure functions. The mock obeys them exactly so the screens behave as
// the real system will; the backend must enforce the same rules. Tested in rules.test.ts.
// (Plain relative imports with .ts so Node's test runner can load this file directly.)

import type { BusinessDate } from "../../dates.ts";
import type { Paisa } from "../../money.ts";
import type {
  DayPlan,
  DayPlanStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  Return,
  ReturnReason,
  Sale,
  SaleLine,
  SaleUnit,
  Shop,
  StaffRole,
  StockLine,
  Visit,
  Expense,
  ExpenseSummary,
  SalesmanHistoryEntry,
  ExpenseType,
  PhotoFlag,
  WriteOff,
} from "../types.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---- shop balance --------------------------------------------------------------------------

/**
 * Balance owed = opening balance + confirmed sales − confirmed payments − returns.
 * Negative means the shop has credit. Pending payments are "in clearing" and do not count.
 */
export function shopBalance(
  shop: Pick<Shop, "id" | "openingBalancePaisa">,
  sales: readonly Sale[],
  payments: readonly Payment[],
  returns: readonly Return[],
): { balancePaisa: Paisa; inClearingPaisa: Paisa } {
  const { balancePaisa, inClearingPaisa } = balanceParts(shop, sales, payments, returns);
  return { balancePaisa, inClearingPaisa };
}

/** The same balance, part by part, for the shop's balance card. */
export function balanceParts(
  shop: Pick<Shop, "id" | "openingBalancePaisa">,
  sales: readonly Sale[],
  payments: readonly Payment[],
  returns: readonly Return[],
): { openingPaisa: Paisa; salesPaisa: Paisa; paymentsPaisa: Paisa; returnsPaisa: Paisa; balancePaisa: Paisa; inClearingPaisa: Paisa } {
  const mine = <T extends { shopId: string }>(xs: readonly T[]) => xs.filter((x) => x.shopId === shop.id);
  const salesPaisa = sum(mine(sales).filter((s) => s.status === "confirmed").map((s) => s.totalPaisa));
  const paymentsPaisa = sum(mine(payments).filter((p) => p.status === "confirmed").map((p) => p.amountPaisa));
  const inClearingPaisa = sum(mine(payments).filter((p) => p.status === "pending").map((p) => p.amountPaisa));
  const returnsPaisa = sum(mine(returns).map((r) => r.valuePaisa));
  const openingPaisa = shop.openingBalancePaisa;
  return { openingPaisa, salesPaisa, paymentsPaisa, returnsPaisa, balancePaisa: openingPaisa + salesPaisa - paymentsPaisa - returnsPaisa, inClearingPaisa };
}

/** How much of the credit limit the balance uses. Credit (a negative balance) uses none of it. */
export function creditUsage(balancePaisa: Paisa, limitPaisa: Paisa): { usedPaisa: Paisa; percent: number | null; over: boolean } {
  const usedPaisa = Math.max(0, balancePaisa);
  return { usedPaisa, percent: limitPaisa > 0 ? Math.round((usedPaisa / limitPaisa) * 100) : null, over: usedPaisa > limitPaisa };
}

export type OverdueItem = { ref: string; saleId?: string; dueDate: BusinessDate; unpaidPaisa: Paisa };

/**
 * What is overdue: debts past their due date with an unpaid part, oldest first. Payments and
 * returns pay off the oldest debt first (the opening balance, then sales by date).
 */
export function overdueItems(
  shop: Pick<Shop, "id" | "openingBalancePaisa">,
  sales: readonly Sale[],
  payments: readonly Payment[],
  returns: readonly Return[],
  today: BusinessDate,
  openingDueDate: BusinessDate,
): OverdueItem[] {
  const credits =
    sum(payments.filter((p) => p.shopId === shop.id && p.status === "confirmed").map((p) => p.amountPaisa)) +
    sum(returns.filter((r) => r.shopId === shop.id).map((r) => r.valuePaisa)) +
    Math.max(0, -shop.openingBalancePaisa);
  const debts: OverdueItem[] = [];
  if (shop.openingBalancePaisa > 0) debts.push({ ref: "Opening balance", dueDate: openingDueDate, unpaidPaisa: shop.openingBalancePaisa });
  for (const s of [...sales].filter((x) => x.shopId === shop.id && x.status === "confirmed").sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo - b.invoiceNo)) {
    debts.push({ ref: `Invoice ${s.invoiceNo}`, saleId: s.id, dueDate: s.dueDate, unpaidPaisa: s.totalPaisa });
  }
  let left = credits;
  for (const d of debts) {
    const used = Math.min(left, d.unpaidPaisa);
    d.unpaidPaisa -= used;
    left -= used;
  }
  return debts.filter((d) => d.unpaidPaisa > 0 && d.dueDate < today);
}

// ---- credit limit --------------------------------------------------------------------------

export type CreditCheck = { ok: true } | { ok: false; overByPaisa: Paisa; canOverride: boolean };

/** A sale that would push the balance above the limit is blocked for salesmen; managers and owners may override. */
export function checkCreditLimit(balancePaisa: Paisa, saleTotalPaisa: Paisa, limitPaisa: Paisa, role: StaffRole): CreditCheck {
  const after = balancePaisa + saleTotalPaisa;
  if (after <= limitPaisa) return { ok: true };
  return { ok: false, overByPaisa: after - limitPaisa, canOverride: role === "owner" || role === "manager" };
}

// ---- sales ---------------------------------------------------------------------------------

/** A sale line priced from the product record. A carton uses the carton price and units per carton. */
export function priceLine(product: Pick<Product, "id" | "unitPricePaisa" | "cartonPricePaisa" | "unitsPerCarton">, quantity: number, unit: SaleUnit): SaleLine {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a whole number above zero.");
  if (unit === "carton" && (product.unitsPerCarton === null || product.cartonPricePaisa === null)) throw new Error("This product is not sold by the carton.");
  const pricePaisa = unit === "carton" ? product.cartonPricePaisa! : product.unitPricePaisa;
  return {
    productId: product.id,
    quantity,
    unit,
    baseUnits: unit === "carton" ? quantity * product.unitsPerCarton! : quantity,
    pricePaisa,
    totalPaisa: pricePaisa * quantity,
  };
}

/** Invoice numbers are sequential per business and never reused (cancelled sales keep theirs). */
export function nextInvoiceNo(sales: readonly Pick<Sale, "invoiceNo">[]): number {
  return sales.reduce((max, s) => Math.max(max, s.invoiceNo), 0) + 1;
}

/** A sale with a confirmed payment against it cannot be cancelled: record a return instead. */
export function canCancelSale(sale: Pick<Sale, "id" | "status">, payments: readonly Pick<Payment, "saleId" | "status">[]): { ok: boolean; reason?: string } {
  if (sale.status === "cancelled") return { ok: false, reason: "This sale is already cancelled." };
  if (payments.some((p) => p.saleId === sale.id && p.status === "confirmed")) {
    return { ok: false, reason: "This sale has a confirmed payment. Record a return instead." };
  }
  return { ok: true };
}

// ---- day plan stock ------------------------------------------------------------------------

const byProduct = (lines: readonly StockLine[] | undefined) => {
  const m = new Map<string, number>();
  for (const l of lines ?? []) m.set(l.productId, (m.get(l.productId) ?? 0) + l.units);
  return m;
};

/** Units sold per product on this plan (confirmed sales only). */
export function soldOnPlan(planId: string, sales: readonly Sale[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sales) if (s.planId === planId && s.status === "confirmed") for (const l of s.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.baseUnits);
  return m;
}

/** What the salesman can still sell: issued − sold. */
export function remainingOnPlan(plan: Pick<DayPlan, "id" | "issued">, sales: readonly Sale[]): Map<string, number> {
  const sold = soldOnPlan(plan.id, sales);
  const out = new Map<string, number>();
  for (const [productId, units] of byProduct(plan.issued)) out.set(productId, units - (sold.get(productId) ?? 0));
  return out;
}

/**
 * Shortage per product = issued − sold − (manager's count, else the salesman's reported unsold)
 * − written off on the plan. The manager's count wins.
 */
export function planShortage(
  plan: Pick<DayPlan, "id" | "issued" | "counted" | "reportedUnsold">,
  sales: readonly Sale[],
  writtenOff: readonly StockLine[] = [],
): { productId: string; issued: number; sold: number; back: number; writtenOff: number; shortage: number }[] {
  const sold = soldOnPlan(plan.id, sales);
  const back = byProduct(plan.counted ?? plan.reportedUnsold);
  const off = byProduct(writtenOff);
  return [...byProduct(plan.issued)].map(([productId, issued]) => {
    const s = sold.get(productId) ?? 0;
    const b = back.get(productId) ?? 0;
    const w = off.get(productId) ?? 0;
    return { productId, issued, sold: s, back: b, writtenOff: w, shortage: issued - s - b - w };
  });
}

// ---- day plan lifecycle --------------------------------------------------------------------

const NEXT: Record<DayPlanStatus, DayPlanStatus | null> = { planned: "in_progress", in_progress: "closed", closed: "reconciled", reconciled: null };

/** planned → in_progress → closed → reconciled, one step at a time, never back. */
export function canMovePlan(from: DayPlanStatus, to: DayPlanStatus): boolean {
  return NEXT[from] === to;
}

/** A salesman may have only one plan in progress, and starts a plan on its own day. */
export function canStartPlan(
  plan: Pick<DayPlan, "id" | "status" | "salesmanId"> & { date?: BusinessDate },
  allPlans: readonly Pick<DayPlan, "id" | "status" | "salesmanId">[],
  today?: BusinessDate,
): { ok: boolean; reason?: string } {
  if (plan.status !== "planned") return { ok: false, reason: "Only a planned day can be started." };
  if (today && plan.date && plan.date !== today) return { ok: false, reason: plan.date > today ? "This plan is for a later day. Start it on the day." : "This plan was for a day that has gone. Ask your manager." };
  if (allPlans.some((p) => p.id !== plan.id && p.salesmanId === plan.salesmanId && p.status === "in_progress")) {
    return { ok: false, reason: "Finish the day already in progress first." };
  }
  return { ok: true };
}

/** A day can close only when every visit is visited or skipped. */
export function canClosePlan(plan: Pick<DayPlan, "status" | "visits">): { ok: boolean; reason?: string } {
  if (plan.status !== "in_progress") return { ok: false, reason: "Only a day in progress can be closed." };
  const open = plan.visits.filter((v) => v.status === "pending").length;
  return open ? { ok: false, reason: `${open} shop${open === 1 ? "" : "s"} still to visit or skip.` } : { ok: true };
}

/** Only a planned plan may be deleted. Nothing else is ever deleted. */
export const canDeletePlan = (plan: Pick<DayPlan, "status">) => plan.status === "planned";

// ---- payments ------------------------------------------------------------------------------

/** Cash is confirmed at once; cheque and online start pending. */
export const initialPaymentStatus = (method: PaymentMethod): PaymentStatus => (method === "cash" ? "confirmed" : "pending");

/**
 * Checks a new payment. Returns plain-language problems, or none. A cheque needs its number,
 * bank, date and a photo; an online payment its reference and a screenshot.
 */
export function validatePayment(
  input: { method: PaymentMethod; amountPaisa: Paisa; chequeNo?: string; bank?: string; chequeDate?: string; reference?: string; imageIds: readonly string[] },
  usedImageIds: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  if (!Number.isSafeInteger(input.amountPaisa) || input.amountPaisa <= 0) problems.push("Enter an amount above zero.");
  if (input.method === "cheque") {
    if (!input.chequeNo?.trim()) problems.push("Enter the cheque number.");
    if (!input.bank?.trim()) problems.push("Enter the bank.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.chequeDate ?? "")) problems.push("Enter the date on the cheque.");
    if (input.imageIds.length === 0) problems.push("Add a photo of the cheque.");
  }
  if (input.method === "online") {
    if (!input.reference?.trim()) problems.push("Enter the payment's reference number.");
    if (input.imageIds.length === 0) problems.push("Add a screenshot of the payment.");
  }
  if (input.imageIds.some((id) => usedImageIds.has(id))) problems.push("This image is already used for another payment.");
  return problems;
}

/** A manager confirms or marks bounced once; after that it cannot change. */
export const canDecidePayment = (p: Pick<Payment, "status">) => p.status === "pending";

// ---- returns -------------------------------------------------------------------------------

/** Damaged and expired goods never go back into sellable stock; only "other" may be restocked. */
export const mayRestock = (reason: ReturnReason, requested: boolean) => requested && reason === "other";

// ---- staff ---------------------------------------------------------------------------------

type Actor = { id: string; role: StaffRole };
type StaffRecord = { id: string; role: StaffRole };

/** A temporary password must be at least this long (the same as Change password). */
export const TEMP_PASSWORD_MIN = 8;

/** The owner adds managers and salesmen; a manager adds salesmen only. Nobody adds an owner. */
export function rolesCreatableBy(role: StaffRole): Exclude<StaffRole, "owner">[] {
  if (role === "owner") return ["manager", "salesman"];
  if (role === "manager") return ["salesman"];
  return [];
}

/** The owner may change anyone's account; a manager only salesmen's. */
export const canEditStaff = (actor: Actor, target: StaffRecord) => actor.role === "owner" || (actor.role === "manager" && target.role === "salesman");

/**
 * Why a change to someone's account is not allowed, or null when it is. There is exactly one
 * owner: the owner cannot be deactivated or given another role, and nobody else becomes owner.
 */
export function checkStaffChange(actor: Actor, target: StaffRecord, change: { role?: StaffRole; active?: boolean }): string | null {
  if (!canEditStaff(actor, target)) return "You cannot change this person's account.";
  if (target.role === "owner") {
    if (change.active === false) return "The owner cannot be deactivated.";
    if (change.role !== undefined && change.role !== "owner") return "The owner's role cannot be changed.";
    return null;
  }
  if (change.role === "owner") return "There is exactly one owner. Nobody else can be made owner.";
  if (change.role !== undefined && change.role !== target.role && !rolesCreatableBy(actor.role).includes(change.role)) return "You cannot give this role.";
  if (change.active === false && actor.id === target.id) return "You cannot deactivate your own account.";
  return null;
}

/** Why a temporary password cannot be set, or null. Your own password goes through Change password. */
export function checkPasswordReset(actor: Actor, target: StaffRecord): string | null {
  if (actor.id === target.id) return "Use Change password for your own account.";
  return canEditStaff(actor, target) ? null : "You cannot reset this person's password.";
}

/** Emails are unique across staff, ignoring case and spaces at the ends. */
export function emailTaken(staff: readonly { id: string; email: string }[], email: string, exceptId?: string): boolean {
  const e = email.trim().toLowerCase();
  return staff.some((s) => s.id !== exceptId && s.email.trim().toLowerCase() === e);
}

// ---- products and categories ----------------------------------------------------------------

/** SKUs are unique in the business, ignoring case and spaces at the ends. */
export function skuTaken(products: readonly { id: string; sku: string }[], sku: string, exceptId?: string): boolean {
  const k = sku.trim().toLowerCase();
  return products.some((p) => p.id !== exceptId && p.sku.trim().toLowerCase() === k);
}

/** Prices are whole paisa, zero or more. */
export const validPrice = (paisa: number) => Number.isInteger(paisa) && paisa >= 0;

/**
 * Selling by the carton is optional. When it is set, units per carton is a whole number above
 * zero and the carton has a price; when it is not, neither is set.
 */
export function checkCarton(p: { unitsPerCarton: number | null; cartonPricePaisa: number | null }): string | null {
  if (p.unitsPerCarton === null) return p.cartonPricePaisa === null ? null : "Set units per carton, or leave the carton price empty.";
  if (!Number.isInteger(p.unitsPerCarton) || p.unitsPerCarton <= 0) return "Units per carton must be a whole number above zero.";
  if (p.cartonPricePaisa === null) return "Enter the carton price.";
  return validPrice(p.cartonPricePaisa) ? null : "The carton price cannot be below zero.";
}

/** Stock is counted in base units; this is the carton equivalent shown beside it. */
export function cartonSplit(units: number, unitsPerCarton: number | null): { cartons: number; loose: number } | null {
  if (unitsPerCarton === null || unitsPerCarton <= 0) return null;
  return { cartons: Math.floor(units / unitsPerCarton), loose: units % unitsPerCarton };
}

export const isLowStock = (p: Pick<Product, "stockUnits" | "lowStockUnits">) => p.stockUnits <= p.lowStockUnits;

/** Margin per base unit. The percentage is of the selling price, and missing when the price is zero. */
export function unitMargin(unitPricePaisa: Paisa, costPricePaisa: Paisa): { paisa: Paisa; percent: number | null } {
  const paisa = unitPricePaisa - costPricePaisa;
  return { paisa, percent: unitPricePaisa > 0 ? Math.round((paisa / unitPricePaisa) * 1000) / 10 : null };
}

/** A stock adjustment adds a signed whole number of base units. Stock never goes below zero. */
export function adjustStock(stockUnits: number, deltaUnits: number): { ok: true; stockUnits: number } | { ok: false; reason: string } {
  if (!Number.isInteger(deltaUnits) || deltaUnits === 0) return { ok: false, reason: "Enter a whole number other than zero, like 24 or -6." };
  const next = stockUnits + deltaUnits;
  if (next < 0) return { ok: false, reason: `Stock cannot go below zero. There ${stockUnits === 1 ? "is" : "are"} only ${stockUnits} in stock.` };
  return { ok: true, stockUnits: next };
}

/** Category names are unique, ignoring case and spaces at the ends. */
export function categoryNameTaken(categories: readonly { id: string; name: string }[], name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === n);
}

/** Only a category no product uses (active or not) can be deleted. Products are deactivated, never deleted. */
export function canDeleteCategory(categoryId: string, products: readonly Pick<Product, "categoryId">[]): { ok: true } | { ok: false; reason: string } {
  const used = products.filter((p) => p.categoryId === categoryId).length;
  return used === 0 ? { ok: true } : { ok: false, reason: `${used} product${used === 1 ? " uses" : "s use"} this category. Move ${used === 1 ? "it" : "them"} to another category first.` };
}

// ---- shops and routes ------------------------------------------------------------------------

/** A PAN is 9 digits. It is optional: "" means the shop has none. */
export function checkPan(pan: string): string | null {
  const p = pan.trim();
  if (p === "") return null;
  return /^\d{9}$/.test(p) ? null : "A PAN is 9 digits, like 600123456.";
}

/** PANs are unique within the business. Shops without one never clash. */
export function panTaken(shops: readonly { id: string; pan: string }[], pan: string, exceptId?: string): boolean {
  const p = pan.trim();
  return p !== "" && shops.some((s) => s.id !== exceptId && s.pan.trim() === p);
}

/** Shop login emails are unique across shops, ignoring case and spaces at the ends. */
export function shopEmailTaken(shops: readonly { id: string; loginEmail?: string }[], email: string, exceptId?: string): boolean {
  const e = email.trim().toLowerCase();
  return e !== "" && shops.some((s) => s.id !== exceptId && (s.loginEmail ?? "").trim().toLowerCase() === e);
}

/** A login needs both an email and a temporary password, or neither. */
export function checkLoginPair(email: string | undefined, password: string | undefined): string | null {
  const hasEmail = Boolean(email?.trim());
  const hasPassword = Boolean(password);
  if (hasEmail === hasPassword) return null;
  return hasEmail ? "Type a temporary password for the shop's login." : "Type the email the shop will sign in with.";
}

/** The location is typed in as numbers: both, or neither, and on the Earth. */
export function checkLocation(latitude: number | null, longitude: number | null): string | null {
  if (latitude === null && longitude === null) return null;
  if (latitude === null || longitude === null) return "Enter both latitude and longitude, or leave both empty.";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude is between -90 and 90, like 28.2096.";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude is between -180 and 180, like 83.9856.";
  return null;
}

/** A shop a salesman adds starts with no credit limit and no opening balance; a manager sets them later. */
export function startingTerms<T extends { creditLimitPaisa: Paisa; openingBalancePaisa: Paisa }>(role: StaffRole, input: T): T {
  return role === "salesman" ? { ...input, creditLimitPaisa: 0, openingBalancePaisa: 0 } : input;
}

/** What a shop has taken: confirmed sales grouped by product and unit, in the range given. */
export function itemsTaken(
  sales: readonly Sale[],
  shopId: string,
  range: { from?: BusinessDate; to?: BusinessDate } = {},
): { productId: string; unit: SaleUnit; quantity: number; baseUnits: number; totalPaisa: Paisa }[] {
  const by = new Map<string, { productId: string; unit: SaleUnit; quantity: number; baseUnits: number; totalPaisa: Paisa }>();
  for (const s of sales) {
    if (s.shopId !== shopId || s.status !== "confirmed" || (range.from && s.date < range.from) || (range.to && s.date > range.to)) continue;
    for (const l of s.lines) {
      const key = `${l.productId} ${l.unit}`;
      const row = by.get(key) ?? { productId: l.productId, unit: l.unit, quantity: 0, baseUnits: 0, totalPaisa: 0 };
      row.quantity += l.quantity;
      row.baseUnits += l.baseUnits;
      row.totalPaisa += l.totalPaisa;
      by.set(key, row);
    }
  }
  return [...by.values()].sort((a, b) => a.productId.localeCompare(b.productId) || a.unit.localeCompare(b.unit));
}

/** Moves one item in an ordered list (for reordering a route's shops). Out-of-range moves do nothing. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A route's new shop list: every shop known, none twice. */
export function checkRouteShops(shopIds: readonly string[], knownShopIds: ReadonlySet<string>): string | null {
  if (new Set(shopIds).size !== shopIds.length) return "A shop can be on the route only once.";
  if (shopIds.some((id) => !knownShopIds.has(id))) return "One of these shops was not found. Reload and try again.";
  return null;
}

/** A route can be deleted only when it has no shops and no day plan ever used it. */
export function canDeleteRoute(route: { id: string; shopIds: readonly string[] }, dayPlans: readonly { routeId: string }[]): { ok: true } | { ok: false; reason: string } {
  if (route.shopIds.length > 0) return { ok: false, reason: "Move or remove its shops first." };
  if (dayPlans.some((p) => p.routeId === route.id)) return { ok: false, reason: "Day plans have used this route, so it stays for their history. Rename it instead." };
  return { ok: true };
}

// ---- issuing stock and reconciling ------------------------------------------------------------

type IssueProduct = Pick<Product, "id" | "name" | "unitName" | "unitsPerCarton" | "stockUnits" | "active">;

/** Base units a line takes: pieces as they are, cartons times units per carton. */
export function lineUnits(line: { unit: SaleUnit; quantity: number }, product: Pick<Product, "unitsPerCarton">): number | null {
  if (line.unit === "carton") return product.unitsPerCarton === null ? null : line.quantity * product.unitsPerCarton;
  return line.quantity;
}

/**
 * Checks stock lines before issuing. Each line needs a whole quantity above zero, a carton only
 * where the product has one, and an active product. Lines for the same product are added up,
 * and together they cannot take more than the warehouse holds.
 */
export function checkIssue(
  lines: readonly { productId: string; unit: SaleUnit; quantity: number }[],
  products: readonly IssueProduct[],
): { problems: { index: number; message: string }[]; totals: Map<string, number> } {
  const problems: { index: number; message: string }[] = [];
  const totals = new Map<string, number>();
  const byId = new Map(products.map((p) => [p.id, p]));
  lines.forEach((l, index) => {
    const p = byId.get(l.productId);
    if (!p) return problems.push({ index, message: "This product was not found." });
    if (!p.active) return problems.push({ index, message: `${p.name} is inactive and cannot be issued.` });
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) return problems.push({ index, message: "Enter a whole number above zero." });
    const units = lineUnits(l, p);
    if (units === null) return problems.push({ index, message: `${p.name} is not sold by the carton.` });
    totals.set(p.id, (totals.get(p.id) ?? 0) + units);
  });
  lines.forEach((l, index) => {
    const p = byId.get(l.productId);
    const total = totals.get(l.productId);
    if (p && total !== undefined && total > p.stockUnits && !problems.some((x) => x.index === index)) {
      problems.push({ index, message: `Only ${p.stockUnits} in the warehouse; ${total === lineUnits(l, p) ? "this line takes" : "these lines take"} ${total}.` });
    }
  });
  if (lines.length === 0) problems.push({ index: -1, message: "Add at least one product to issue." });
  return { problems: problems.sort((a, b) => a.index - b.index), totals };
}

/** One plan per salesman, route and date. */
export function planClash(plans: readonly Pick<DayPlan, "salesmanId" | "routeId" | "date">[], plan: Pick<DayPlan, "salesmanId" | "routeId" | "date">): boolean {
  return plans.some((p) => p.salesmanId === plan.salesmanId && p.routeId === plan.routeId && p.date === plan.date);
}

/** Plans are made for today or a day ahead, never for a day already gone. */
export const canPlanFor = (date: BusinessDate, today: BusinessDate) => date >= today;

/** Cash the salesman took on this plan: confirmed cash payments. */
export function cashOnPlan(planId: string, payments: readonly Pick<Payment, "planId" | "method" | "status" | "amountPaisa">[]): Paisa {
  return sum(payments.filter((p) => p.planId === planId && p.method === "cash" && p.status === "confirmed").map((p) => p.amountPaisa));
}

/**
 * Why a plan cannot be reconciled with this count, or null. The plan must be closed, every
 * product issued must be counted, and no count can be more than could be left: issued − sold
 * − written off.
 */
export function checkReconcile(
  plan: Pick<DayPlan, "id" | "status" | "issued">,
  counted: readonly StockLine[],
  sales: readonly Sale[],
  writtenOff: readonly StockLine[] = [],
): string | null {
  if (plan.status !== "closed") return plan.status === "reconciled" ? "This day is already reconciled." : "The salesman has to close the day first.";
  const sold = soldOnPlan(plan.id, sales);
  const off = byProduct(writtenOff);
  const count = byProduct(counted);
  for (const [productId, issued] of byProduct(plan.issued)) {
    const c = count.get(productId);
    if (c === undefined) return "Count every product that was issued.";
    if (!Number.isInteger(c) || c < 0) return "Counts are whole numbers, zero or more.";
    if (c > issued - (sold.get(productId) ?? 0) - (off.get(productId) ?? 0)) return "A count is more than could have come back. Check it again.";
  }
  if (counted.some((l) => !byProduct(plan.issued).has(l.productId))) return "Count only the products that were issued.";
  return null;
}

// ---- the salesman's day ------------------------------------------------------------------------

/**
 * Why a visit cannot change, or null. Only while the day is in progress. A skip needs a reason.
 * A shop skipped earlier can still be visited; a visited shop stays visited (it may have a sale).
 */
export function checkVisitChange(planStatus: DayPlanStatus, visit: Pick<Visit, "status">, change: { status: "visited" | "skipped"; skipReason?: string }): string | null {
  if (planStatus !== "in_progress") return planStatus === "planned" ? "Start the day first." : "This day is closed. Nothing can change now.";
  if (visit.status === "visited") return change.status === "visited" ? null : "This shop is already visited, so it cannot be skipped.";
  if (change.status === "skipped") {
    const reason = change.skipReason?.trim() ?? "";
    if (!reason) return "Say why the shop is skipped.";
    if (reason.length > 200) return "Keep the reason under 200 characters.";
  }
  return null;
}

/** An ad-hoc visit: only while in progress, an active shop, not already on the day's list. */
export function checkAddVisit(plan: Pick<DayPlan, "status" | "visits">, shop: Pick<Shop, "id" | "active">): string | null {
  if (plan.status !== "in_progress") return "Start the day first.";
  if (!shop.active) return "This shop is inactive.";
  if (plan.visits.some((v) => v.shopId === shop.id)) return "This shop is already on today's list.";
  return null;
}

/** A shop a salesman adds needs a login (email and temporary password); a manager's need not. */
export const shopNeedsLogin = (role: StaffRole) => role === "salesman";

/**
 * Why a day cannot be closed with these numbers, or null. Every visit done; every product issued
 * counted, with no count above what should be left (issued − sold − written off); cash whole
 * paisa, zero or more.
 */
export function checkClose(
  plan: Pick<DayPlan, "id" | "status" | "visits" | "issued">,
  reportedUnsold: readonly StockLine[],
  cashHandedOverPaisa: number,
  sales: readonly Sale[],
  writtenOff: readonly StockLine[] = [],
): string | null {
  const ready = canClosePlan(plan);
  if (!ready.ok) return ready.reason ?? "This day cannot be closed.";
  const sold = soldOnPlan(plan.id, sales);
  const off = byProduct(writtenOff);
  const counts = byProduct(reportedUnsold);
  for (const [productId, issued] of byProduct(plan.issued)) {
    const c = counts.get(productId);
    if (c === undefined) return "Count every product you carried.";
    if (!Number.isInteger(c) || c < 0) return "Counts are whole numbers, zero or more.";
    if (c > issued - (sold.get(productId) ?? 0) - (off.get(productId) ?? 0)) return "A count is more than you should have left. Check it again.";
  }
  if (!Number.isInteger(cashHandedOverPaisa) || cashHandedOverPaisa < 0) return "Enter the cash you hand over, in rupees.";
  return null;
}

// ---- selling, collecting, returning on a visit -------------------------------------------------

type SellProduct = Pick<Product, "id" | "name" | "unitName" | "unitsPerCarton" | "unitPricePaisa" | "cartonPricePaisa" | "active">;

/**
 * Checks sale lines against what the salesman still carries (issued − sold on the plan). Lines
 * for the same product are added up. Prices are never part of the input: they come from the
 * product record (priceLine).
 */
export function checkSaleLines(
  lines: readonly { productId: string; unit: SaleUnit; quantity: number }[],
  products: readonly SellProduct[],
  carried: ReadonlyMap<string, number>,
): string[] {
  if (lines.length === 0) return ["Add at least one item."];
  const problems: string[] = [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const totals = new Map<string, number>();
  for (const l of lines) {
    const p = byId.get(l.productId);
    if (!p) { problems.push("A product was not found."); continue; }
    if (!p.active) { problems.push(`${p.name} is inactive and cannot be sold.`); continue; }
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) { problems.push(`Enter a whole quantity of ${p.name}.`); continue; }
    if (l.unit === "carton" && p.unitsPerCarton === null) { problems.push(`${p.name} is not sold by the carton.`); continue; }
    totals.set(p.id, (totals.get(p.id) ?? 0) + (l.unit === "carton" ? l.quantity * p.unitsPerCarton! : l.quantity));
  }
  for (const [id, units] of totals) {
    const left = carried.get(id) ?? 0;
    if (units > left) problems.push(`Only ${left} ${byId.get(id)!.name} left with you; this sale takes ${units}.`);
  }
  return problems;
}

/**
 * The sale's money: subtotal from the priced lines, less a discount (0 up to the subtotal),
 * then how much is paid in cash now (0 up to the total). What is left goes on credit (udharo).
 */
export function saleMoney(
  pricedLines: readonly Pick<SaleLine, "totalPaisa">[],
  discountPaisa: number,
  cashPaidPaisa: number,
): { subtotalPaisa: Paisa; discountPaisa: Paisa; totalPaisa: Paisa; cashPaidPaisa: Paisa; creditPaisa: Paisa; problems: string[] } {
  const subtotalPaisa = sum(pricedLines.map((l) => l.totalPaisa));
  const problems: string[] = [];
  if (!Number.isInteger(discountPaisa) || discountPaisa < 0) problems.push("A discount is zero or more.");
  else if (discountPaisa > subtotalPaisa) problems.push("The discount cannot be more than the items.");
  const discount = problems.length ? 0 : discountPaisa;
  const totalPaisa = subtotalPaisa - discount;
  if (!Number.isInteger(cashPaidPaisa) || cashPaidPaisa < 0) problems.push("Cash paid is zero or more.");
  else if (cashPaidPaisa > totalPaisa) problems.push("Cash paid cannot be more than the sale. Take the rest as a payment.");
  const cash = Number.isInteger(cashPaidPaisa) && cashPaidPaisa >= 0 && cashPaidPaisa <= totalPaisa ? cashPaidPaisa : 0;
  return { subtotalPaisa, discountPaisa: discount, totalPaisa, cashPaidPaisa: cash, creditPaisa: totalPaisa - cash, problems };
}

/** A due date for the credit part: from the sale's day up to a year after. */
export function checkDueDate(dueDate: string, saleDate: BusinessDate): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return "Choose a due date.";
  if (dueDate < saleDate) return "The due date cannot be before the sale.";
  const limit = new Date(`${saleDate}T00:00:00Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  if (dueDate > limit.toISOString().slice(0, 10)) return "Keep the due date within a year.";
  return null;
}

/** What a shop can still return of a product: bought (confirmed sales) less already returned. */
export function returnable(productId: string, shopId: string, sales: readonly Sale[], returns: readonly Return[]): number {
  const bought = sum(sales.filter((s) => s.shopId === shopId && s.status === "confirmed").flatMap((s) => s.lines.filter((l) => l.productId === productId).map((l) => l.baseUnits)));
  const back = sum(returns.filter((r) => r.shopId === shopId).flatMap((r) => r.lines.filter((l) => l.productId === productId).map((l) => l.units)));
  return bought - back;
}

/** Credited value of returned goods: the product's own price per base unit. */
export const returnValue = (units: number, product: Pick<Product, "unitPricePaisa">) => units * product.unitPricePaisa;

/**
 * Checks return lines: whole units above zero, a known reason, never more than the shop bought
 * and has not already returned; "restock" only where the rule allows (mayRestock).
 */
export function checkReturnLines(
  lines: readonly { productId: string; units: number; reason: ReturnReason; restock: boolean }[],
  products: readonly Pick<Product, "id" | "name">[],
  canReturn: (productId: string) => number,
): string[] {
  if (lines.length === 0) return ["Add at least one item to return."];
  const problems: string[] = [];
  const totals = new Map<string, number>();
  for (const l of lines) {
    const p = products.find((x) => x.id === l.productId);
    if (!p) { problems.push("A product was not found."); continue; }
    if (!Number.isInteger(l.units) || l.units <= 0) { problems.push(`Enter how many ${p.name} come back.`); continue; }
    if (!["damaged", "expired", "other"].includes(l.reason)) { problems.push(`Choose why ${p.name} comes back.`); continue; }
    if (l.restock && !mayRestock(l.reason, true)) { problems.push(`Damaged or expired ${p.name} cannot go back into stock.`); continue; }
    totals.set(p.id, (totals.get(p.id) ?? 0) + l.units);
  }
  for (const [id, units] of totals) {
    const most = canReturn(id);
    if (units > most) problems.push(`This shop can return at most ${most} ${products.find((p) => p.id === id)!.name}: that is what it bought and has not returned.`);
  }
  return problems;
}

/** Metres between two points on Earth (haversine). */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** How old a photo may be, and how far from the shop, before the manager is asked to look. */
export const PHOTO_MAX_AGE_MINUTES = 15;
export const PHOTO_MAX_DISTANCE_M = 250;

/**
 * Flags for the manager to review. They never block the upload. Old: the camera's own time is
 * well before the upload. Far: taken away from the shop's saved location. Duplicate: the same
 * picture was sent before. No photo data: the picture came without the camera's own time.
 */
export function photoFlags(input: { takenAt: string; deviceTakenAt?: string; distanceM?: number; fingerprint: string; knownFingerprints: ReadonlySet<string> }): PhotoFlag[] {
  const flags: PhotoFlag[] = [];
  if (input.deviceTakenAt && Date.parse(input.takenAt) - Date.parse(input.deviceTakenAt) > PHOTO_MAX_AGE_MINUTES * 60_000) flags.push("old_photo");
  if (input.distanceM !== undefined && input.distanceM > PHOTO_MAX_DISTANCE_M) flags.push("far_from_shop");
  if (input.knownFingerprints.has(input.fingerprint)) flags.push("duplicate");
  if (!input.deviceTakenAt) flags.push("no_photo_data");
  return flags;
}

const SALARY_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A salesman adds their own fuel, khaja and miscellaneous expenses; salary is the manager's.
 * Salary needs the staff member and the month it covers; only fuel and khaja go on a day plan.
 */
export function checkExpense(
  input: { type: ExpenseType; amountPaisa: number; date: string; note: string; staffId?: string; planId?: string; salaryMonth?: string },
  actor: { id: string; role: StaffRole },
  today: BusinessDate,
): string | null {
  if (actor.role === "salesman") {
    if (input.type === "salary") return "Salary is added by your manager.";
    if (input.staffId && input.staffId !== actor.id) return "You can add only your own expenses.";
  }
  if (input.type === "salary") {
    if (!input.staffId) return "Choose the staff member the salary is for.";
    if (!input.salaryMonth || !SALARY_MONTH.test(input.salaryMonth)) return "Choose the month the salary covers.";
  }
  if (input.planId && input.type !== "fuel" && input.type !== "khaja") return "Only fuel and khaja go on a day plan.";
  if (!Number.isInteger(input.amountPaisa) || input.amountPaisa <= 0) return "Enter an amount above zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Choose a date.";
  if (input.date > today) return "An expense cannot be for a day still to come.";
  if (input.note.length > 300) return "Keep the note under 300 characters.";
  return null;
}

/** A day plan on an expense must be the same staff member's. */
export function checkExpensePlan(plan: Pick<DayPlan, "salesmanId"> | undefined, staffId: string): string | null {
  if (!plan) return "That day plan was not found.";
  if (plan.salesmanId !== staffId) return "That day plan belongs to someone else. Choose one of this person's days.";
  return null;
}

const EXPENSE_TYPES: readonly ExpenseType[] = ["salary", "fuel", "khaja", "misc"];

/** Totals by type and by month (of the expense date) for the expenses in a range. */
export function expenseSummary(expenses: readonly Pick<Expense, "type" | "date" | "amountPaisa">[], range: { from: BusinessDate; to: BusinessDate }): ExpenseSummary {
  const items = expenses.filter((e) => e.date >= range.from && e.date <= range.to);
  const months = new Map<string, Record<ExpenseType, number>>();
  for (const e of items) {
    const month = e.date.slice(0, 7);
    const row = months.get(month) ?? { salary: 0, fuel: 0, khaja: 0, misc: 0 };
    row[e.type] += e.amountPaisa;
    months.set(month, row);
  }
  return {
    from: range.from,
    to: range.to,
    totalPaisa: sum(items.map((e) => e.amountPaisa)),
    count: items.length,
    byType: EXPENSE_TYPES.map((type) => {
      const of = items.filter((e) => e.type === type);
      return { type, count: of.length, amountPaisa: sum(of.map((e) => e.amountPaisa)) };
    }),
    byMonth: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, byType]) => ({ month, byType, totalPaisa: sum(Object.values(byType)) })),
  };
}

/** One salesman's numbers over a date range (confirmed sales; bounced payments left out). */
export function salesmanNumbers(
  salesmanId: string,
  range: { from: BusinessDate; to: BusinessDate },
  data: {
    sales: readonly Sale[];
    payments: readonly Payment[];
    returns: readonly Return[];
    expenses: readonly Pick<Expense, "staffId" | "date" | "amountPaisa">[];
    dayPlans?: readonly DayPlan[];
    writeOffs?: readonly Pick<WriteOff, "planId" | "productId" | "units">[];
    products?: readonly Pick<Product, "id" | "unitPricePaisa">[];
  },
) {
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const sales = data.sales.filter((s) => s.salesmanId === salesmanId && s.status === "confirmed" && inRange(s.date));
  const payments = data.payments.filter((p) => p.salesmanId === salesmanId && p.status !== "bounced" && inRange(p.date));
  const group = <K extends string>(items: readonly Sale[], key: (s: Sale) => K) => {
    const m = new Map<K, { count: number; totalPaisa: number }>();
    for (const s of items) {
      const row = m.get(key(s)) ?? { count: 0, totalPaisa: 0 };
      row.count += 1;
      row.totalPaisa += s.totalPaisa;
      m.set(key(s), row);
    }
    return m;
  };
  const products = new Map<string, { baseUnits: number; totalPaisa: number }>();
  for (const s of sales) for (const l of s.lines) {
    const row = products.get(l.productId) ?? { baseUnits: 0, totalPaisa: 0 };
    row.baseUnits += l.baseUnits;
    row.totalPaisa += l.totalPaisa;
    products.set(l.productId, row);
  }
  return {
    from: range.from,
    to: range.to,
    sales: { count: sales.length, totalPaisa: sum(sales.map((s) => s.totalPaisa)) },
    payments: (["cash", "cheque", "online"] as const)
      .map((method) => {
        const ps = payments.filter((p) => p.method === method);
        return { method, count: ps.length, amountPaisa: sum(ps.map((p) => p.amountPaisa)), pendingCount: ps.filter((p) => p.status === "pending").length };
      })
      .filter((x) => x.count > 0),
    perDay: [...group(sales, (s) => s.date)].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    perShop: [...group(sales, (s) => s.shopId)].map(([shopId, v]) => ({ shopId, ...v })).sort((a, b) => b.totalPaisa - a.totalPaisa),
    topProducts: [...products].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.totalPaisa - a.totalPaisa).slice(0, 5),
    returnsPaisa: sum(data.returns.filter((r) => r.salesmanId === salesmanId && inRange(r.date)).map((r) => r.valuePaisa)),
    expensesPaisa: sum(data.expenses.filter((e) => e.staffId === salesmanId && inRange(e.date)).map((e) => e.amountPaisa)),
    shortage: shortageTotals(
      (data.dayPlans ?? []).filter((p) => p.salesmanId === salesmanId && p.status === "reconciled" && inRange(p.date)),
      data.sales,
      data.writeOffs ?? [],
      data.products ?? [],
    ),
  };
}

/**
 * Shortage over reconciled day plans: issued − sold − counted back − written off, product by
 * product, valued at the unit price. Only shortfalls count; a surplus on one product does not
 * cancel a shortage on another.
 */
export function shortageTotals(
  plans: readonly DayPlan[],
  sales: readonly Sale[],
  writeOffs: readonly Pick<WriteOff, "planId" | "productId" | "units">[],
  products: readonly Pick<Product, "id" | "unitPricePaisa">[],
) {
  const price = new Map(products.map((p) => [p.id, p.unitPricePaisa]));
  const units = new Map<string, number>();
  for (const plan of plans) {
    const off = writeOffs.filter((w) => w.planId === plan.id).map((w) => ({ productId: w.productId, units: w.units }));
    for (const line of planShortage(plan, sales, off)) if (line.shortage > 0) units.set(line.productId, (units.get(line.productId) ?? 0) + line.shortage);
  }
  const byProduct = [...units].map(([productId, u]) => ({ productId, units: u, valuePaisa: u * (price.get(productId) ?? 0) })).sort((a, b) => b.valuePaisa - a.valuePaisa);
  return { plans: plans.length, units: sum(byProduct.map((x) => x.units)), valuePaisa: sum(byProduct.map((x) => x.valuePaisa)), byProduct };
}

/** One day's confirmed sales and confirmed cash, by shop and by salesman, biggest first. */
export function salesOnDay(day: BusinessDate, sales: readonly Sale[], payments: readonly Payment[]) {
  const sold = sales.filter((x) => x.date === day && x.status === "confirmed");
  const cash = payments.filter((x) => x.date === day && x.method === "cash" && x.status === "confirmed");
  const rows = <K extends "shopId" | "salesmanId">(key: K) =>
    [...new Set([...sold.map((x) => x[key]), ...cash.map((x) => x[key])])]
      .map((id) => {
        const s = sold.filter((x) => x[key] === id);
        return { id, count: s.length, totalPaisa: sum(s.map((x) => x.totalPaisa)), cashPaisa: sum(cash.filter((x) => x[key] === id).map((x) => x.amountPaisa)) };
      })
      .sort((a, b) => b.totalPaisa - a.totalPaisa || b.cashPaisa - a.cashPaisa);
  return {
    date: day,
    count: sold.length,
    totalPaisa: sum(sold.map((x) => x.totalPaisa)),
    cashCollectedPaisa: sum(cash.map((x) => x.amountPaisa)),
    byShop: rows("shopId").map(({ id, ...r }) => ({ shopId: id, ...r })),
    bySalesman: rows("salesmanId").map(({ id, ...r }) => ({ salesmanId: id, ...r })),
  };
}

/** Every sale and payment a salesman took in a range, newest first. */
export function salesmanHistory(salesmanId: string, range: { from: BusinessDate; to: BusinessDate }, sales: readonly Sale[], payments: readonly Payment[]): SalesmanHistoryEntry[] {
  const inRange = (d: string) => d >= range.from && d <= range.to;
  const METHOD = { cash: "Cash", cheque: "Cheque", online: "Online" } as const;
  return [
    ...sales.filter((x) => x.salesmanId === salesmanId && inRange(x.date)).map((x): SalesmanHistoryEntry => ({ kind: "sale", id: x.id, date: x.date, at: x.createdAt, shopId: x.shopId, amountPaisa: x.totalPaisa, status: x.status, ref: `Invoice ${x.invoiceNo}` })),
    ...payments.filter((x) => x.salesmanId === salesmanId && inRange(x.date)).map((x): SalesmanHistoryEntry => ({ kind: "payment", id: x.id, date: x.date, at: x.createdAt, shopId: x.shopId, amountPaisa: x.amountPaisa, status: x.status, ref: METHOD[x.method] })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
}

// ---- manager: cancelling, write-offs -------------------------------------------------------------

/** Why a sale cannot be cancelled with this reason, or null. A reason is required. */
export function checkCancel(sale: Pick<Sale, "id" | "status">, payments: readonly Pick<Payment, "saleId" | "status">[], reason: string): string | null {
  const can = canCancelSale(sale, payments);
  if (!can.ok) return can.reason ?? "This sale cannot be cancelled.";
  const r = reason.trim();
  if (!r) return "Say why the sale is cancelled.";
  if (r.length > 200) return "Keep the reason under 200 characters.";
  return null;
}

/**
 * Where a cancelled sale's goods go. While its day is still open (in progress or closed, not yet
 * counted) they are back with the salesman and are counted at reconcile. Once the day is
 * counted, or for a sale on no day, they go back into the warehouse.
 */
export const cancelledGoodsGo = (planStatus: DayPlanStatus | undefined): "salesman" | "warehouse" =>
  planStatus === "in_progress" || planStatus === "closed" ? "salesman" : "warehouse";

/**
 * Why a write-off cannot be made, or null. Whole units above zero and a reason. Without a day
 * plan it comes out of the warehouse, so never more than the warehouse holds. With a day plan it
 * is goods the salesman already carries: the warehouse is not reduced again, the plan must not
 * be counted yet, and never more than is left on it.
 */
export function checkWriteOff(
  input: { units: number; reason: ReturnReason; note: string },
  product: Pick<Product, "id" | "name" | "stockUnits">,
  plan: (Pick<DayPlan, "id" | "status" | "issued">) | null,
  sales: readonly Sale[],
  writtenOff: readonly Pick<WriteOff, "planId" | "productId" | "units">[],
): string | null {
  if (!Number.isInteger(input.units) || input.units <= 0) return "Enter a whole quantity above zero.";
  if (!["damaged", "expired", "other"].includes(input.reason)) return "Choose a reason.";
  if (input.note.length > 300) return "Keep the note under 300 characters.";
  if (!plan) {
    return input.units > product.stockUnits ? `Only ${product.stockUnits} ${product.name} in the warehouse.` : null;
  }
  if (plan.status !== "in_progress" && plan.status !== "closed") return plan.status === "planned" ? "That day has not started; its stock is still to be issued." : "That day is already counted. Write it off without a day plan.";
  const issued = sum(plan.issued.filter((l) => l.productId === product.id).map((l) => l.units));
  if (issued === 0) return `${product.name} was not issued on that day plan.`;
  const sold = soldOnPlan(plan.id, sales).get(product.id) ?? 0;
  const off = sum(writtenOff.filter((w) => w.planId === plan.id && w.productId === product.id).map((w) => w.units));
  const left = issued - sold - off;
  return input.units > left ? `Only ${left} ${product.name} left on that day plan.` : null;
}
