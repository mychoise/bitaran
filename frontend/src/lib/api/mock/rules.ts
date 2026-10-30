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
  const mine = <T extends { shopId: string }>(xs: readonly T[]) => xs.filter((x) => x.shopId === shop.id);
  const sold = sum(mine(sales).filter((s) => s.status === "confirmed").map((s) => s.totalPaisa));
  const paid = sum(mine(payments).filter((p) => p.status === "confirmed").map((p) => p.amountPaisa));
  const clearing = sum(mine(payments).filter((p) => p.status === "pending").map((p) => p.amountPaisa));
  const returned = sum(mine(returns).map((r) => r.valuePaisa));
  return { balancePaisa: shop.openingBalancePaisa + sold - paid - returned, inClearingPaisa: clearing };
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

/** A salesman may have only one plan in progress. */
export function canStartPlan(plan: Pick<DayPlan, "id" | "status" | "salesmanId">, allPlans: readonly Pick<DayPlan, "id" | "status" | "salesmanId">[]): { ok: boolean; reason?: string } {
  if (plan.status !== "planned") return { ok: false, reason: "Only a planned day can be started." };
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

/** Checks a new payment. Returns plain-language problems, or none. */
export function validatePayment(
  input: { method: PaymentMethod; amountPaisa: Paisa; chequeNo?: string; imageIds: readonly string[] },
  usedImageIds: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  if (!Number.isSafeInteger(input.amountPaisa) || input.amountPaisa <= 0) problems.push("Enter an amount above zero.");
  if (input.method === "cheque") {
    if (!input.chequeNo?.trim()) problems.push("Enter the cheque number.");
    if (input.imageIds.length === 0) problems.push("Add a photo of the cheque.");
  }
  if (input.method === "online" && input.imageIds.length === 0) problems.push("Add a screenshot of the payment.");
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
