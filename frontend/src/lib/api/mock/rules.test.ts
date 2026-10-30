import { test } from "node:test";
import assert from "node:assert/strict";
import type { DayPlan, Payment, Return, Sale } from "../types.ts";
import {
  canCancelSale,
  canClosePlan,
  canDecidePayment,
  canDeletePlan,
  canMovePlan,
  canEditStaff,
  canStartPlan,
  checkCreditLimit,
  checkPasswordReset,
  checkStaffChange,
  emailTaken,
  initialPaymentStatus,
  mayRestock,
  nextInvoiceNo,
  overdueItems,
  planShortage,
  priceLine,
  remainingOnPlan,
  rolesCreatableBy,
  shopBalance,
  validatePayment,
} from "./rules.ts";

const shop = { id: "s1", openingBalancePaisa: 50_000 };
const sale = (o: Partial<Sale>): Sale => ({
  id: "x", invoiceNo: 1, date: "2026-10-01", createdAt: "", salesmanId: "u", shopId: "s1", lines: [], totalPaisa: 0, dueDate: "2026-10-08", status: "confirmed", ...o,
});
const pay = (o: Partial<Payment>): Payment => ({
  id: "p", date: "2026-10-02", createdAt: "", shopId: "s1", salesmanId: "u", method: "cash", amountPaisa: 0, status: "confirmed", imageIds: [], ...o,
});
const ret = (o: Partial<Return>): Return => ({ id: "r", date: "2026-10-03", createdAt: "", shopId: "s1", salesmanId: "u", lines: [], valuePaisa: 0, ...o });

test("balance = opening + confirmed sales − confirmed payments − returns", () => {
  const sales = [sale({ id: "a", totalPaisa: 100_000 }), sale({ id: "b", totalPaisa: 30_000, status: "cancelled" }), sale({ id: "c", shopId: "other", totalPaisa: 999 })];
  const payments = [pay({ amountPaisa: 40_000 }), pay({ id: "q", amountPaisa: 25_000, method: "cheque", status: "pending" }), pay({ id: "z", amountPaisa: 10_000, status: "bounced" })];
  const returns = [ret({ valuePaisa: 5_000 })];
  assert.deepEqual(shopBalance(shop, sales, payments, returns), { balancePaisa: 50_000 + 100_000 - 40_000 - 5_000, inClearingPaisa: 25_000 });
});

test("a bounced cheque never reduces the balance", () => {
  const b = shopBalance({ id: "s1", openingBalancePaisa: 0 }, [sale({ totalPaisa: 10_000 })], [pay({ amountPaisa: 10_000, method: "cheque", status: "bounced" })], []);
  assert.equal(b.balancePaisa, 10_000);
});

test("overpaying leaves a negative balance (credit)", () => {
  const b = shopBalance({ id: "s1", openingBalancePaisa: 0 }, [sale({ totalPaisa: 10_000 })], [pay({ amountPaisa: 12_000 })], []);
  assert.equal(b.balancePaisa, -2_000);
});

test("overdue pays the oldest debt first and lists what is past due, oldest first", () => {
  const sales = [
    sale({ id: "a", invoiceNo: 1, date: "2026-10-01", dueDate: "2026-10-08", totalPaisa: 30_000 }),
    sale({ id: "b", invoiceNo: 2, date: "2026-10-05", dueDate: "2026-10-12", totalPaisa: 20_000 }),
    sale({ id: "c", invoiceNo: 3, date: "2026-10-12", dueDate: "2026-10-19", totalPaisa: 15_000 }),
  ];
  // opening 50,000 + a + b + c; paid 60,000 → opening cleared, a part paid (10,000 of 30,000)
  const items = overdueItems(shop, sales, [pay({ amountPaisa: 60_000 })], [], "2026-10-15", "2026-09-30");
  assert.deepEqual(items.map((i) => [i.ref, i.unpaidPaisa]), [["Invoice 1", 20_000], ["Invoice 2", 20_000]]);
});

test("credit limit blocks salesmen, managers and owners may override", () => {
  assert.deepEqual(checkCreditLimit(80_000, 20_000, 100_000, "salesman"), { ok: true });
  assert.deepEqual(checkCreditLimit(80_000, 30_000, 100_000, "salesman"), { ok: false, overByPaisa: 10_000, canOverride: false });
  assert.deepEqual(checkCreditLimit(80_000, 30_000, 100_000, "manager"), { ok: false, overByPaisa: 10_000, canOverride: true });
  assert.equal((checkCreditLimit(80_000, 30_000, 100_000, "owner") as { canOverride: boolean }).canOverride, true);
});

test("prices come from the product; cartons use the carton price and units per carton", () => {
  const product = { id: "p1", unitPricePaisa: 2_500, cartonPricePaisa: 70_000, unitsPerCarton: 30 };
  assert.deepEqual(priceLine(product, 2, "carton"), { productId: "p1", quantity: 2, unit: "carton", baseUnits: 60, pricePaisa: 70_000, totalPaisa: 140_000 });
  assert.equal(priceLine(product, 3, "unit").totalPaisa, 7_500);
  assert.throws(() => priceLine(product, 0, "unit"));
  assert.throws(() => priceLine(product, 1.5, "unit"));
});

test("invoice numbers are sequential and never reused", () => {
  assert.equal(nextInvoiceNo([]), 1);
  assert.equal(nextInvoiceNo([{ invoiceNo: 1 }, { invoiceNo: 3 }]), 4);
});

test("a sale with a confirmed payment cannot be cancelled", () => {
  assert.equal(canCancelSale({ id: "a", status: "confirmed" }, []).ok, true);
  assert.equal(canCancelSale({ id: "a", status: "confirmed" }, [{ saleId: "a", status: "pending" }]).ok, true);
  assert.equal(canCancelSale({ id: "a", status: "confirmed" }, [{ saleId: "a", status: "confirmed" }]).ok, false);
  assert.equal(canCancelSale({ id: "a", status: "cancelled" }, []).ok, false);
});

test("remaining stock and shortage; the manager's count wins", () => {
  const plan: Pick<DayPlan, "id" | "issued" | "counted" | "reportedUnsold"> = {
    id: "d1",
    issued: [{ productId: "oil", units: 48 }, { productId: "soap", units: 10 }],
    reportedUnsold: [{ productId: "oil", units: 12 }, { productId: "soap", units: 3 }],
  };
  const sales = [
    sale({ planId: "d1", lines: [{ productId: "oil", quantity: 36, unit: "unit", baseUnits: 36, pricePaisa: 1, totalPaisa: 36 }] }),
    sale({ planId: "d1", status: "cancelled", lines: [{ productId: "soap", quantity: 5, unit: "unit", baseUnits: 5, pricePaisa: 1, totalPaisa: 5 }] }),
  ];
  assert.equal(remainingOnPlan(plan, sales).get("oil"), 12);
  assert.equal(remainingOnPlan(plan, sales).get("soap"), 10);
  // by the salesman's report: oil 48 − 36 − 12 = 0; soap 10 − 0 − 3 − 2 written off = 5
  const reported = planShortage(plan, sales, [{ productId: "soap", units: 2 }]);
  assert.deepEqual(reported.map((r) => [r.productId, r.shortage]), [["oil", 0], ["soap", 5]]);
  // the manager counts 11 bottles of oil: 1 short
  const counted = planShortage({ ...plan, counted: [{ productId: "oil", units: 11 }, { productId: "soap", units: 3 }] }, sales, [{ productId: "soap", units: 2 }]);
  assert.equal(counted.find((r) => r.productId === "oil")?.shortage, 1);
});

test("day plan moves one step at a time, never back", () => {
  assert.equal(canMovePlan("planned", "in_progress"), true);
  assert.equal(canMovePlan("in_progress", "closed"), true);
  assert.equal(canMovePlan("closed", "reconciled"), true);
  assert.equal(canMovePlan("planned", "closed"), false);
  assert.equal(canMovePlan("reconciled", "closed"), false);
});

test("only one plan in progress per salesman; close needs every visit done; only planned may be deleted", () => {
  const plans = [{ id: "a", status: "in_progress" as const, salesmanId: "u1" }, { id: "b", status: "planned" as const, salesmanId: "u1" }, { id: "c", status: "planned" as const, salesmanId: "u2" }];
  assert.equal(canStartPlan(plans[1], plans).ok, false);
  assert.equal(canStartPlan(plans[2], plans).ok, true);
  assert.equal(canClosePlan({ status: "in_progress", visits: [{ shopId: "s", status: "pending" }] }).ok, false);
  assert.equal(canClosePlan({ status: "in_progress", visits: [{ shopId: "s", status: "skipped" }, { shopId: "t", status: "visited" }] }).ok, true);
  assert.equal(canDeletePlan({ status: "planned" }), true);
  assert.equal(canDeletePlan({ status: "in_progress" }), false);
});

test("payments: cash confirmed at once, cheque and online pending, proof required, images not reused, decided once", () => {
  assert.equal(initialPaymentStatus("cash"), "confirmed");
  assert.equal(initialPaymentStatus("cheque"), "pending");
  assert.equal(initialPaymentStatus("online"), "pending");
  assert.deepEqual(validatePayment({ method: "cheque", amountPaisa: 100, imageIds: [] }, new Set()), ["Enter the cheque number.", "Add a photo of the cheque."]);
  assert.deepEqual(validatePayment({ method: "online", amountPaisa: 100, imageIds: [] }, new Set()), ["Add a screenshot of the payment."]);
  assert.deepEqual(validatePayment({ method: "online", amountPaisa: 100, imageIds: ["img1"] }, new Set(["img1"])), ["This image is already used for another payment."]);
  assert.deepEqual(validatePayment({ method: "cash", amountPaisa: 0, imageIds: [] }, new Set()), ["Enter an amount above zero."]);
  assert.equal(canDecidePayment({ status: "pending" }), true);
  assert.equal(canDecidePayment({ status: "bounced" }), false);
  assert.equal(canDecidePayment({ status: "confirmed" }), false);
});

test("damaged and expired goods are never restocked", () => {
  assert.equal(mayRestock("damaged", true), false);
  assert.equal(mayRestock("expired", true), false);
  assert.equal(mayRestock("other", true), true);
  assert.equal(mayRestock("other", false), false);
});

const owner = { id: "u-owner", role: "owner" as const };
const manager = { id: "u-manager", role: "manager" as const };
const salesman = { id: "u-salesman", role: "salesman" as const };

test("the owner adds managers and salesmen; a manager adds salesmen only", () => {
  assert.deepEqual(rolesCreatableBy("owner"), ["manager", "salesman"]);
  assert.deepEqual(rolesCreatableBy("manager"), ["salesman"]);
  assert.deepEqual(rolesCreatableBy("salesman"), []);
  assert.equal(canEditStaff(owner, manager), true);
  assert.equal(canEditStaff(manager, salesman), true);
  assert.equal(canEditStaff(manager, owner), false);
  assert.equal(canEditStaff(manager, { id: "u-m2", role: "manager" }), false);
  assert.equal(canEditStaff(salesman, salesman), false);
});

test("there is exactly one owner, who cannot be deactivated or change role", () => {
  assert.equal(checkStaffChange(owner, owner, { active: false }), "The owner cannot be deactivated.");
  assert.equal(checkStaffChange(owner, owner, { role: "manager" }), "The owner's role cannot be changed.");
  assert.equal(checkStaffChange(owner, owner, { role: "owner" }), null);
  assert.equal(checkStaffChange(manager, owner, { active: false }), "You cannot change this person's account.");
  assert.equal(checkStaffChange(owner, manager, { role: "owner" }), "There is exactly one owner. Nobody else can be made owner.");
  assert.equal(checkStaffChange(owner, salesman, { role: "manager" }), null);
  assert.equal(checkStaffChange(owner, manager, { active: false }), null);
  assert.equal(checkStaffChange(manager, salesman, { role: "manager" }), "You cannot give this role.");
  assert.equal(checkStaffChange(manager, salesman, { active: false }), null);
});

test("nobody deactivates or resets their own account here", () => {
  assert.equal(checkStaffChange(manager, { id: "u-manager", role: "salesman" }, { active: false }), "You cannot deactivate your own account.");
  assert.equal(checkPasswordReset(owner, owner), "Use Change password for your own account.");
  assert.equal(checkPasswordReset(owner, manager), null);
  assert.equal(checkPasswordReset(manager, salesman), null);
  assert.equal(checkPasswordReset(manager, owner), "You cannot reset this person's password.");
});

test("staff emails are unique, ignoring case and outer spaces", () => {
  const staff = [{ id: "a", email: "Owner@Example.com" }, { id: "b", email: "sales@example.com" }];
  assert.equal(emailTaken(staff, " owner@example.COM "), true);
  assert.equal(emailTaken(staff, "owner@example.com", "a"), false, "a person keeps their own email");
  assert.equal(emailTaken(staff, "new@example.com"), false);
});
