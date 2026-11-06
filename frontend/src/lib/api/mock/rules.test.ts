import { test } from "node:test";
import assert from "node:assert/strict";
import type { DayPlan, Payment, Return, Sale } from "../types.ts";
import {
  cancelledGoodsGo,
  checkCancel,
  checkWriteOff,
  checkDueDate,
  checkExpense,
  checkExpensePlan,
  expenseSummary,
  salesInRange,
  unitsSold,
  salesmanHistory,
  shortageTotals,
  checkReturnLines,
  checkSaleLines,
  distanceMeters,
  photoFlags,
  returnable,
  returnValue,
  saleMoney,
  salesmanNumbers,
  checkAddVisit,
  checkClose,
  checkVisitChange,
  shopNeedsLogin,
  canPlanFor,
  cashOnPlan,
  checkIssue,
  checkReconcile,
  lineUnits,
  planClash,
  balanceParts,
  canDeleteRoute,
  checkLocation,
  checkLoginPair,
  checkPan,
  checkRouteShops,
  creditUsage,
  itemsTaken,
  moveItem,
  panTaken,
  shopEmailTaken,
  startingTerms,
  adjustStock,
  canDeleteCategory,
  cartonSplit,
  categoryNameTaken,
  checkCarton,
  isLowStock,
  skuTaken,
  unitMargin,
  validPrice,
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
  collectable,
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
  assert.equal(canStartPlan({ ...plans[2], date: "2026-11-05" }, plans, "2026-11-05").ok, true, "on its own day");
  assert.match(canStartPlan({ ...plans[2], date: "2026-11-06" }, plans, "2026-11-05").reason ?? "", /later day/);
  assert.match(canStartPlan({ ...plans[2], date: "2026-11-04" }, plans, "2026-11-05").reason ?? "", /has gone/);
  assert.equal(canClosePlan({ status: "in_progress", visits: [{ id: "v", shopId: "s", status: "pending" }] }).ok, false);
  assert.equal(canClosePlan({ status: "in_progress", visits: [{ id: "v", shopId: "s", status: "skipped" }, { id: "w", shopId: "t", status: "visited" }] }).ok, true);
  assert.equal(canDeletePlan({ status: "planned" }), true);
  assert.equal(canDeletePlan({ status: "in_progress" }), false);
});

test("payments: cash confirmed at once, cheque and online pending, proof required, images not reused, decided once", () => {
  assert.equal(initialPaymentStatus("cash"), "confirmed");
  assert.equal(initialPaymentStatus("cheque"), "pending");
  assert.equal(initialPaymentStatus("online"), "pending");
  assert.deepEqual(validatePayment({ method: "cheque", amountPaisa: 100, imageIds: [] }, new Set()), ["Enter the cheque number.", "Enter the bank.", "Enter the date on the cheque.", "Add a photo of the cheque."]);
  assert.deepEqual(validatePayment({ method: "cheque", amountPaisa: 100, chequeNo: "001", bank: "Demo Bank", chequeDate: "2026-11-05", imageIds: ["c1"] }, new Set()), []);
  assert.deepEqual(validatePayment({ method: "online", amountPaisa: 100, imageIds: [] }, new Set()), ["Enter the payment's reference number.", "Add a screenshot of the payment."]);
  assert.deepEqual(validatePayment({ method: "online", amountPaisa: 100, reference: "R1", imageIds: ["img1"] }, new Set(["img1"])), ["This image is already used for another payment."]);
  assert.deepEqual(validatePayment({ method: "cash", amountPaisa: 0, imageIds: [] }, new Set()), ["Enter an amount above zero."]);
  assert.equal(canDecidePayment({ status: "pending" }), true);
  assert.equal(canDecidePayment({ status: "bounced" }), false);
  assert.equal(canDecidePayment({ status: "confirmed" }), false);
});

test("a payment can be no more than the shop owes, less what is already in clearing", () => {
  assert.equal(collectable(10_000, 0), 10_000);
  assert.equal(collectable(10_000, 4_000), 6_000);
  assert.equal(collectable(10_000, 12_000), 0);
  assert.equal(collectable(-500, 0), 0); // the shop has credit
  const cash = (amountPaisa: number) => ({ method: "cash" as const, amountPaisa, imageIds: [] });
  assert.deepEqual(validatePayment(cash(6_000), new Set(), 6_000), []);
  assert.deepEqual(validatePayment(cash(6_001), new Set(), 6_000), ["That is more than the shop owes. The most you can take is Rs 60.00."]);
  assert.deepEqual(validatePayment(cash(100), new Set(), 0), ["This shop owes nothing right now, so there is nothing to collect."]);
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

test("prices are zero or more, in whole paisa", () => {
  assert.equal(validPrice(0), true);
  assert.equal(validPrice(2_500), true);
  assert.equal(validPrice(-1), false);
  assert.equal(validPrice(10.5), false);
});

test("units per carton is above zero when set, and the carton then has a price", () => {
  assert.equal(checkCarton({ unitsPerCarton: null, cartonPricePaisa: null }), null, "selling by the carton is optional");
  assert.equal(checkCarton({ unitsPerCarton: 24, cartonPricePaisa: 140_000 }), null);
  assert.equal(checkCarton({ unitsPerCarton: 0, cartonPricePaisa: 0 }), "Units per carton must be a whole number above zero.");
  assert.equal(checkCarton({ unitsPerCarton: 2.5, cartonPricePaisa: 0 }), "Units per carton must be a whole number above zero.");
  assert.equal(checkCarton({ unitsPerCarton: 24, cartonPricePaisa: null }), "Enter the carton price.");
  assert.equal(checkCarton({ unitsPerCarton: null, cartonPricePaisa: 500 }), "Set units per carton, or leave the carton price empty.");
  assert.equal(checkCarton({ unitsPerCarton: 24, cartonPricePaisa: -1 }), "The carton price cannot be below zero.");
});

test("SKUs are unique, ignoring case and outer spaces", () => {
  const products = [{ id: "a", sku: "DEMO-SNK-001" }];
  assert.equal(skuTaken(products, " demo-snk-001 "), true);
  assert.equal(skuTaken(products, "DEMO-SNK-001", "a"), false, "a product keeps its own SKU");
  assert.equal(skuTaken(products, "DEMO-SNK-002"), false);
});

test("stock is in base units, with the carton equivalent beside it", () => {
  assert.deepEqual(cartonSplit(480, 24), { cartons: 20, loose: 0 });
  assert.deepEqual(cartonSplit(65, 24), { cartons: 2, loose: 17 });
  assert.equal(cartonSplit(65, null), null);
  assert.equal(isLowStock({ stockUnits: 48, lowStockUnits: 48 }), true);
  assert.equal(isLowStock({ stockUnits: 49, lowStockUnits: 48 }), false);
});

test("a stock adjustment is signed and never takes stock below zero", () => {
  assert.deepEqual(adjustStock(10, 24), { ok: true, stockUnits: 34 });
  assert.deepEqual(adjustStock(10, -10), { ok: true, stockUnits: 0 });
  assert.equal(adjustStock(10, -11).ok, false);
  assert.equal(adjustStock(10, 0).ok, false);
  assert.equal(adjustStock(10, 1.5).ok, false);
});

test("margin per unit, as a share of the selling price", () => {
  assert.deepEqual(unitMargin(5_000, 4_100), { paisa: 900, percent: 18 });
  assert.deepEqual(unitMargin(0, 100), { paisa: -100, percent: null });
  assert.deepEqual(unitMargin(3_000, 3_500), { paisa: -500, percent: -16.7 });
});

test("categories: unique names, deleted only when no product uses them", () => {
  assert.equal(categoryNameTaken([{ id: "c1", name: "Snacks" }], " snacks "), true);
  assert.equal(categoryNameTaken([{ id: "c1", name: "Snacks" }], "Snacks", "c1"), false);
  assert.deepEqual(canDeleteCategory("c1", []), { ok: true });
  const inUse = canDeleteCategory("c1", [{ categoryId: "c1" }, { categoryId: "c1" }, { categoryId: "c2" }]);
  assert.equal(inUse.ok, false);
  assert.match(inUse.ok ? "" : inUse.reason, /^2 products use this category/);
});

test("a shop's balance, part by part, adds up to the balance", () => {
  const parts = balanceParts(
    shop,
    [sale({ totalPaisa: 30_000 }), sale({ id: "c", totalPaisa: 99_000, status: "cancelled" })],
    [pay({ amountPaisa: 10_000 }), pay({ id: "q", amountPaisa: 5_000, status: "pending" }), pay({ id: "b", amountPaisa: 7_000, status: "bounced" })],
    [ret({ valuePaisa: 2_000 })],
  );
  assert.deepEqual(parts, { openingPaisa: 50_000, salesPaisa: 30_000, paymentsPaisa: 10_000, returnsPaisa: 2_000, balancePaisa: 68_000, inClearingPaisa: 5_000 });
  assert.equal(parts.balancePaisa, shopBalance(shop, [sale({ totalPaisa: 30_000 })], [pay({ amountPaisa: 10_000 })], [ret({ valuePaisa: 2_000 })]).balancePaisa);
});

test("credit used: none when the shop has credit, flagged when over the limit", () => {
  assert.deepEqual(creditUsage(15_000, 20_000), { usedPaisa: 15_000, percent: 75, over: false });
  assert.deepEqual(creditUsage(-4_000, 20_000), { usedPaisa: 0, percent: 0, over: false });
  assert.deepEqual(creditUsage(25_000, 20_000), { usedPaisa: 25_000, percent: 125, over: true });
  assert.deepEqual(creditUsage(5_000, 0), { usedPaisa: 5_000, percent: null, over: true });
});

test("PAN is optional, 9 digits, and unique within the business", () => {
  assert.equal(checkPan(""), null);
  assert.equal(checkPan("600123456"), null);
  assert.equal(checkPan("60012345"), "A PAN is 9 digits, like 600123456.");
  assert.equal(checkPan("60012345a"), "A PAN is 9 digits, like 600123456.");
  const shops = [{ id: "a", pan: "600123456" }, { id: "b", pan: "" }];
  assert.equal(panTaken(shops, " 600123456 "), true);
  assert.equal(panTaken(shops, "600123456", "a"), false, "a shop keeps its own PAN");
  assert.equal(panTaken(shops, ""), false, "shops without a PAN never clash");
});

test("shop login emails are unique, and come with a password", () => {
  const shops = [{ id: "a", loginEmail: "Shop@Example.com" }, { id: "b" }];
  assert.equal(shopEmailTaken(shops, "shop@example.com "), true);
  assert.equal(shopEmailTaken(shops, "shop@example.com", "a"), false);
  assert.equal(shopEmailTaken(shops, ""), false);
  assert.equal(checkLoginPair(undefined, undefined), null);
  assert.equal(checkLoginPair("x@example.com", "secret-123"), null);
  assert.equal(checkLoginPair("x@example.com", ""), "Type a temporary password for the shop's login.");
  assert.equal(checkLoginPair("", "secret-123"), "Type the email the shop will sign in with.");
});

test("location: both numbers or neither, within range", () => {
  assert.equal(checkLocation(null, null), null);
  assert.equal(checkLocation(28.2096, 83.9856), null);
  assert.equal(checkLocation(28.2, null), "Enter both latitude and longitude, or leave both empty.");
  assert.match(checkLocation(91, 83) ?? "", /^Latitude/);
  assert.match(checkLocation(28, 181) ?? "", /^Longitude/);
});

test("a salesman's new shop starts with no credit and no opening balance", () => {
  const input = { name: "X", creditLimitPaisa: 50_000, openingBalancePaisa: 9_000 };
  assert.deepEqual(startingTerms("salesman", input), { name: "X", creditLimitPaisa: 0, openingBalancePaisa: 0 });
  assert.deepEqual(startingTerms("manager", input), input);
  assert.deepEqual(startingTerms("owner", input), input);
});

test("items taken: confirmed sales grouped by product and unit, within the dates", () => {
  const line = (productId: string, unit: "unit" | "carton", quantity: number, baseUnits: number, totalPaisa: number) => ({ productId, unit, quantity, baseUnits, pricePaisa: 0, totalPaisa });
  const sales = [
    sale({ date: "2026-10-01", lines: [line("p1", "carton", 2, 48, 2_000), line("p1", "unit", 5, 5, 300)] }),
    sale({ id: "s2", date: "2026-10-05", lines: [line("p1", "carton", 1, 24, 1_000)] }),
    sale({ id: "s3", date: "2026-10-06", status: "cancelled", lines: [line("p1", "carton", 9, 216, 9_000)] }),
    sale({ id: "s4", shopId: "other", lines: [line("p1", "carton", 9, 216, 9_000)] }),
  ];
  assert.deepEqual(itemsTaken(sales, "s1"), [
    { productId: "p1", unit: "carton", quantity: 3, baseUnits: 72, totalPaisa: 3_000 },
    { productId: "p1", unit: "unit", quantity: 5, baseUnits: 5, totalPaisa: 300 },
  ]);
  assert.deepEqual(itemsTaken(sales, "s1", { from: "2026-10-02" }), [{ productId: "p1", unit: "carton", quantity: 1, baseUnits: 24, totalPaisa: 1_000 }]);
});

test("route order: move a shop up or down; the list is checked before saving", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, -1), ["a", "b", "c"], "the first cannot move up");
  const known = new Set(["a", "b", "c"]);
  assert.equal(checkRouteShops(["a", "c"], known), null);
  assert.equal(checkRouteShops(["a", "a"], known), "A shop can be on the route only once.");
  assert.match(checkRouteShops(["z"], known) ?? "", /not found/);
});

test("a route is deleted only when empty and never used by a day plan", () => {
  assert.deepEqual(canDeleteRoute({ id: "r1", shopIds: [] }, []), { ok: true });
  assert.equal(canDeleteRoute({ id: "r1", shopIds: ["a"] }, []).ok, false);
  assert.equal(canDeleteRoute({ id: "r1", shopIds: [] }, [{ routeId: "r1" }]).ok, false);
});

const issueProducts = [
  { id: "p1", name: "Noodles", unitName: "packet", unitsPerCarton: 24, stockUnits: 50, active: true },
  { id: "p2", name: "Rice", unitName: "bag", unitsPerCarton: null, stockUnits: 10, active: true },
  { id: "p3", name: "Old soap", unitName: "bar", unitsPerCarton: 12, stockUnits: 100, active: false },
];

test("issuing: pieces or cartons, in base units", () => {
  assert.equal(lineUnits({ unit: "unit", quantity: 5 }, { unitsPerCarton: 24 }), 5);
  assert.equal(lineUnits({ unit: "carton", quantity: 2 }, { unitsPerCarton: 24 }), 48);
  assert.equal(lineUnits({ unit: "carton", quantity: 2 }, { unitsPerCarton: null }), null);
});

test("issuing never takes more than the warehouse holds, lines added up per product", () => {
  const ok = checkIssue([{ productId: "p1", unit: "carton", quantity: 2 }, { productId: "p2", unit: "unit", quantity: 10 }], issueProducts);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.totals.get("p1"), 48);
  const over = checkIssue([{ productId: "p1", unit: "carton", quantity: 2 }, { productId: "p1", unit: "unit", quantity: 3 }], issueProducts);
  assert.equal(over.problems.length, 2, "both lines of the product are marked");
  assert.match(over.problems[0].message, /^Only 50 in the warehouse; these lines take 51/);
  const one = checkIssue([{ productId: "p2", unit: "unit", quantity: 11 }], issueProducts);
  assert.match(one.problems[0].message, /this line takes 11/);
});

test("issuing: bad lines are refused with a reason", () => {
  const r = checkIssue(
    [
      { productId: "p2", unit: "carton", quantity: 1 },
      { productId: "p3", unit: "unit", quantity: 1 },
      { productId: "p1", unit: "unit", quantity: 0 },
      { productId: "p1", unit: "unit", quantity: 1.5 },
    ],
    issueProducts,
  );
  assert.deepEqual(r.problems.map((x) => x.message), ["Rice is not sold by the carton.", "Old soap is inactive and cannot be issued.", "Enter a whole number above zero.", "Enter a whole number above zero."]);
  assert.deepEqual(checkIssue([], issueProducts).problems, [{ index: -1, message: "Add at least one product to issue." }]);
});

test("one plan per salesman, route and date; never for a past day", () => {
  const plans = [{ salesmanId: "u1", routeId: "r1", date: "2026-11-05" }];
  assert.equal(planClash(plans, { salesmanId: "u1", routeId: "r1", date: "2026-11-05" }), true);
  assert.equal(planClash(plans, { salesmanId: "u1", routeId: "r1", date: "2026-11-06" }), false);
  assert.equal(planClash(plans, { salesmanId: "u2", routeId: "r1", date: "2026-11-05" }), false);
  assert.equal(canPlanFor("2026-11-04", "2026-11-04"), true);
  assert.equal(canPlanFor("2026-11-03", "2026-11-04"), false);
});

test("cash on a plan: confirmed cash payments only", () => {
  const ps = [
    pay({ planId: "d1", amountPaisa: 5_000 }),
    pay({ id: "b", planId: "d1", method: "cheque", amountPaisa: 9_000 }),
    pay({ id: "c", planId: "d2", amountPaisa: 7_000 }),
    pay({ id: "d", planId: "d1", amountPaisa: 1_000, status: "pending" }),
  ];
  assert.equal(cashOnPlan("d1", ps), 5_000);
});

test("reconcile: a closed plan, every product counted, no count above what could be left", () => {
  const plan = { id: "d1", status: "closed" as const, issued: [{ productId: "p1", units: 48 }] };
  const sold = [sale({ planId: "d1", lines: [{ productId: "p1", quantity: 10, unit: "unit", baseUnits: 10, pricePaisa: 0, totalPaisa: 0 }] })];
  assert.equal(checkReconcile(plan, [{ productId: "p1", units: 37 }], sold), null, "one short is allowed: it is the shortage");
  assert.equal(checkReconcile(plan, [{ productId: "p1", units: 38 }], sold), null);
  assert.match(checkReconcile(plan, [{ productId: "p1", units: 39 }], sold) ?? "", /more than could have come back/);
  assert.match(checkReconcile(plan, [{ productId: "p1", units: 36 }], sold, [{ productId: "p1", units: 3 }]) ?? "", /more than could have come back/);
  assert.equal(checkReconcile(plan, [], sold), "Count every product that was issued.");
  assert.equal(checkReconcile(plan, [{ productId: "p1", units: -1 }], sold), "Counts are whole numbers, zero or more.");
  assert.equal(checkReconcile({ ...plan, status: "in_progress" }, [{ productId: "p1", units: 30 }], sold), "The salesman has to close the day first.");
  assert.equal(checkReconcile({ ...plan, status: "reconciled" }, [{ productId: "p1", units: 30 }], sold), "This day is already reconciled.");
});

test("visits: only while in progress; a skip needs a reason; visited stays visited", () => {
  assert.equal(checkVisitChange("in_progress", { status: "pending" }, { status: "visited" }), null);
  assert.equal(checkVisitChange("in_progress", { status: "pending" }, { status: "skipped", skipReason: "Shop closed" }), null);
  assert.equal(checkVisitChange("in_progress", { status: "pending" }, { status: "skipped", skipReason: "  " }), "Say why the shop is skipped.");
  assert.equal(checkVisitChange("in_progress", { status: "skipped" }, { status: "visited" }), null, "a skipped shop can be visited later");
  assert.match(checkVisitChange("in_progress", { status: "visited" }, { status: "skipped", skipReason: "x" }) ?? "", /already visited/);
  assert.equal(checkVisitChange("planned", { status: "pending" }, { status: "visited" }), "Start the day first.");
  assert.match(checkVisitChange("closed", { status: "pending" }, { status: "visited" }) ?? "", /closed/);
});

test("ad-hoc visits and a salesman's new shop", () => {
  const plan = { status: "in_progress" as const, visits: [{ id: "v1", shopId: "s1", status: "pending" as const }] };
  assert.equal(checkAddVisit(plan, { id: "s2", active: true }), null);
  assert.equal(checkAddVisit(plan, { id: "s1", active: true }), "This shop is already on today's list.");
  assert.equal(checkAddVisit(plan, { id: "s2", active: false }), "This shop is inactive.");
  assert.equal(checkAddVisit({ ...plan, status: "planned" }, { id: "s2", active: true }), "Start the day first.");
  assert.equal(shopNeedsLogin("salesman"), true);
  assert.equal(shopNeedsLogin("manager"), false);
});

test("closing the day: every visit done, every product counted within what is left, cash given", () => {
  const plan = {
    id: "d1",
    status: "in_progress" as const,
    issued: [{ productId: "p1", units: 48 }],
    visits: [{ id: "v1", shopId: "s1", status: "visited" as const }, { id: "v2", shopId: "s2", status: "skipped" as const }],
  };
  const sold = [sale({ planId: "d1", lines: [{ productId: "p1", quantity: 8, unit: "unit", baseUnits: 8, pricePaisa: 0, totalPaisa: 0 }] })];
  assert.equal(checkClose(plan, [{ productId: "p1", units: 40 }], 5_000, sold), null);
  assert.equal(checkClose(plan, [{ productId: "p1", units: 39 }], 0, sold), null, "fewer than left is a shortage, allowed");
  assert.match(checkClose(plan, [{ productId: "p1", units: 41 }], 0, sold) ?? "", /more than you should have left/);
  assert.equal(checkClose(plan, [], 0, sold), "Count every product you carried.");
  assert.match(checkClose(plan, [{ productId: "p1", units: 40 }], -1, sold) ?? "", /cash/);
  assert.match(checkClose({ ...plan, visits: [{ id: "v1", shopId: "s1", status: "pending" as const }] }, [{ productId: "p1", units: 40 }], 0, sold) ?? "", /still to visit or skip/);
});

const sellProducts = [
  { id: "p1", name: "Noodles", unitName: "packet", unitsPerCarton: 24, unitPricePaisa: 2_500, cartonPricePaisa: 57_000, active: true },
  { id: "p2", name: "Rice", unitName: "bag", unitsPerCarton: null, unitPricePaisa: 55_000, cartonPricePaisa: null, active: true },
];

test("selling: never more than you carry, lines added up per product", () => {
  const carried = new Map([["p1", 30], ["p2", 2]]);
  assert.deepEqual(checkSaleLines([{ productId: "p1", unit: "carton", quantity: 1 }, { productId: "p1", unit: "unit", quantity: 6 }], sellProducts, carried), []);
  assert.deepEqual(checkSaleLines([{ productId: "p1", unit: "carton", quantity: 1 }, { productId: "p1", unit: "unit", quantity: 7 }], sellProducts, carried), ["Only 30 Noodles left with you; this sale takes 31."]);
  assert.deepEqual(checkSaleLines([{ productId: "p2", unit: "carton", quantity: 1 }], sellProducts, carried), ["Rice is not sold by the carton."]);
  assert.deepEqual(checkSaleLines([], sellProducts, carried), ["Add at least one item."]);
  assert.deepEqual(checkSaleLines([{ productId: "p1", unit: "unit", quantity: 0 }], sellProducts, carried), ["Enter a whole quantity of Noodles."]);
});

test("sale money: discount up to the items, cash up to the total, the rest on credit", () => {
  const lines = [{ totalPaisa: 57_000 }, { totalPaisa: 5_000 }];
  assert.deepEqual(saleMoney(lines, 2_000, 10_000), { subtotalPaisa: 62_000, discountPaisa: 2_000, totalPaisa: 60_000, cashPaidPaisa: 10_000, creditPaisa: 50_000, problems: [] });
  assert.deepEqual(saleMoney(lines, 70_000, 0).problems, ["The discount cannot be more than the items."]);
  assert.deepEqual(saleMoney(lines, 0, 70_000).problems, ["Cash paid cannot be more than the sale. Take the rest as a payment."]);
  assert.equal(saleMoney(lines, 0, 62_000).creditPaisa, 0, "paid in full");
});

test("the credit check uses only the part not paid now", () => {
  const credit = saleMoney([{ totalPaisa: 30_000 }], 0, 25_000).creditPaisa;
  assert.deepEqual(checkCreditLimit(18_000, credit, 20_000, "salesman"), { ok: false, overByPaisa: 3_000, canOverride: false });
  assert.deepEqual(checkCreditLimit(18_000, saleMoney([{ totalPaisa: 30_000 }], 0, 28_000).creditPaisa, 20_000, "salesman"), { ok: true });
});

test("due date: from the sale's day, within a year", () => {
  assert.equal(checkDueDate("2026-11-12", "2026-11-05"), null);
  assert.equal(checkDueDate("2026-11-04", "2026-11-05"), "The due date cannot be before the sale.");
  assert.equal(checkDueDate("2027-11-06", "2026-11-05"), "Keep the due date within a year.");
  assert.equal(checkDueDate("", "2026-11-05"), "Choose a due date.");
});

test("returns: at most what the shop bought and has not returned; damaged and expired never restocked", () => {
  const line = (quantity: number) => ({ productId: "p1", unit: "unit" as const, quantity, baseUnits: quantity, pricePaisa: 2_500, totalPaisa: quantity * 2_500 });
  const sales = [sale({ shopId: "s1", lines: [line(10)] }), sale({ id: "c", shopId: "s1", status: "cancelled", lines: [line(50)] })];
  const rets = [ret({ shopId: "s1", lines: [{ productId: "p1", units: 3, reason: "damaged", restocked: false, valuePaisa: 7_500 }] })];
  assert.equal(returnable("p1", "s1", sales, rets), 7);
  assert.equal(returnValue(4, { unitPricePaisa: 2_500 }), 10_000);
  const can = (id: string) => returnable(id, "s1", sales, rets);
  assert.deepEqual(checkReturnLines([{ productId: "p1", units: 7, reason: "expired", restock: false }], sellProducts, can), []);
  assert.match(checkReturnLines([{ productId: "p1", units: 8, reason: "other", restock: false }], sellProducts, can)[0], /at most 7/);
  assert.deepEqual(checkReturnLines([{ productId: "p1", units: 1, reason: "damaged", restock: true }], sellProducts, can), ["Damaged or expired Noodles cannot go back into stock."]);
  assert.deepEqual(checkReturnLines([{ productId: "p1", units: 1, reason: "other", restock: true }], sellProducts, can), []);
});

test("visit photos: flags for the manager, never a block", () => {
  const takenAt = "2026-11-05T05:00:00.000Z";
  const base = { takenAt, deviceTakenAt: "2026-11-05T04:58:00.000Z", fingerprint: "abc", knownFingerprints: new Set<string>() };
  assert.deepEqual(photoFlags({ ...base, deviceTakenAt: "2026-11-05T04:50:00.000Z", distanceM: 40 }), []);
  assert.deepEqual(photoFlags({ ...base, deviceTakenAt: "2026-11-05T04:40:00.000Z" }), ["old_photo"]);
  assert.deepEqual(photoFlags({ ...base, distanceM: 900 }), ["far_from_shop"]);
  assert.deepEqual(photoFlags({ ...base, knownFingerprints: new Set(["abc"]) }), ["duplicate"]);
  assert.deepEqual(photoFlags({ ...base, deviceTakenAt: undefined }), ["no_photo_data"]);
  assert.equal(distanceMeters({ latitude: 28.2096, longitude: 83.9856 }, { latitude: 28.2096, longitude: 83.9856 }), 0);
  const d = distanceMeters({ latitude: 28.2096, longitude: 83.9856 }, { latitude: 28.2186, longitude: 83.9856 });
  assert.ok(d > 990 && d < 1010, `about a kilometre, got ${d}`);
});

test("expenses: a salesman adds their own fuel, khaja and misc, never for a day to come", () => {
  const me = { id: "u1", role: "salesman" as const };
  assert.equal(checkExpense({ type: "fuel", amountPaisa: 50_000, date: "2026-11-05", note: "" }, me, "2026-11-05"), null);
  assert.equal(checkExpense({ type: "salary", amountPaisa: 50_000, date: "2026-11-05", note: "" }, me, "2026-11-05"), "Salary is added by your manager.");
  assert.equal(checkExpense({ type: "khaja", amountPaisa: 50_000, date: "2026-11-05", note: "", staffId: "u2" }, me, "2026-11-05"), "You can add only your own expenses.");
  assert.equal(checkExpense({ type: "misc", amountPaisa: 0, date: "2026-11-05", note: "" }, me, "2026-11-05"), "Enter an amount above zero.");
  assert.equal(checkExpense({ type: "misc", amountPaisa: 100, date: "2026-11-06", note: "" }, me, "2026-11-05"), "An expense cannot be for a day still to come.");
});

test("expenses: salary needs the staff member and its month; only fuel and khaja go on a day plan", () => {
  const m = { id: "m", role: "manager" as const };
  const base = { amountPaisa: 100, date: "2026-11-05", note: "" };
  assert.equal(checkExpense({ ...base, type: "salary" }, m, "2026-11-05"), "Choose the staff member the salary is for.");
  assert.equal(checkExpense({ ...base, type: "salary", staffId: "u1" }, m, "2026-11-05"), "Choose the month the salary covers.");
  assert.equal(checkExpense({ ...base, type: "salary", staffId: "u1", salaryMonth: "2026-13" }, m, "2026-11-05"), "Choose the month the salary covers.");
  assert.equal(checkExpense({ ...base, type: "salary", staffId: "u1", salaryMonth: "2026-10" }, m, "2026-11-05"), null);
  assert.equal(checkExpense({ ...base, type: "salary", staffId: "u1", salaryMonth: "2026-10", amountPaisa: -5 }, m, "2026-11-05"), "Enter an amount above zero.");
  assert.equal(checkExpense({ ...base, type: "fuel", planId: "d1" }, m, "2026-11-05"), null);
  assert.equal(checkExpense({ ...base, type: "misc", planId: "d1" }, m, "2026-11-05"), "Only fuel and khaja go on a day plan.");
  assert.equal(checkExpensePlan({ salesmanId: "u1" }, "u1"), null);
  assert.match(checkExpensePlan({ salesmanId: "u2" }, "u1") ?? "", /someone else/);
  assert.equal(checkExpensePlan(undefined, "u1"), "That day plan was not found.");
});

test("expense summary: totals by type and by month, inside the range only", () => {
  const e = (type: "salary" | "fuel" | "khaja" | "misc", date: string, amountPaisa: number) => ({ type, date, amountPaisa });
  const s = expenseSummary([e("salary", "2026-10-02", 1_000), e("fuel", "2026-10-20", 200), e("fuel", "2026-11-01", 300), e("khaja", "2026-11-03", 50), e("misc", "2026-09-30", 999)], { from: "2026-10-01", to: "2026-11-04" });
  assert.equal(s.totalPaisa, 1_550);
  assert.equal(s.count, 4);
  assert.deepEqual(s.byType.map((t) => [t.type, t.count, t.amountPaisa]), [["salary", 1, 1_000], ["fuel", 2, 500], ["khaja", 1, 50], ["misc", 0, 0]]);
  assert.deepEqual(s.byMonth.map((m) => [m.month, m.totalPaisa, m.byType.fuel]), [["2026-10", 1_200, 200], ["2026-11", 350, 300]]);
});

test("a salesman's numbers: confirmed sales, payments without bounced ones, by day, shop and product", () => {
  const l = (productId: string, total: number) => ({ productId, unit: "unit" as const, quantity: 1, baseUnits: 1, pricePaisa: total, totalPaisa: total });
  const sales = [
    sale({ id: "a", salesmanId: "u1", date: "2026-11-01", shopId: "s1", totalPaisa: 1_000, lines: [l("p1", 1_000)] }),
    sale({ id: "b", salesmanId: "u1", date: "2026-11-02", shopId: "s2", totalPaisa: 3_000, lines: [l("p2", 3_000)] }),
    sale({ id: "c", salesmanId: "u1", date: "2026-11-02", shopId: "s1", totalPaisa: 9_000, status: "cancelled" }),
    sale({ id: "d", salesmanId: "u2", date: "2026-11-02", shopId: "s1", totalPaisa: 5_000 }),
  ];
  const payments = [pay({ salesmanId: "u1", date: "2026-11-01", amountPaisa: 1_000 }), pay({ id: "q", salesmanId: "u1", date: "2026-11-02", method: "cheque", status: "bounced", amountPaisa: 7_000 })];
  const n = salesmanNumbers("u1", { from: "2026-11-01", to: "2026-11-02" }, { sales, payments, returns: [], expenses: [{ staffId: "u1", date: "2026-11-02", amountPaisa: 500 }] });
  assert.deepEqual(n.sales, { count: 2, totalPaisa: 4_000 });
  assert.deepEqual(n.payments, [{ method: "cash", count: 1, amountPaisa: 1_000, pendingCount: 0 }]);
  assert.deepEqual(n.perDay.map((d) => d.totalPaisa), [1_000, 3_000]);
  assert.deepEqual(n.perShop[0], { shopId: "s2", count: 1, totalPaisa: 3_000 });
  assert.equal(n.topProducts[0].productId, "p2");
  assert.equal(n.expensesPaisa, 500);
});

test("cancelling a sale: a reason is required; never with a confirmed payment", () => {
  const s1 = sale({ id: "s1" });
  assert.equal(checkCancel(s1, [], "Wrong shop"), null);
  assert.equal(checkCancel(s1, [], "  "), "Say why the sale is cancelled.");
  assert.match(checkCancel(s1, [pay({ saleId: "s1", status: "confirmed" })], "Wrong shop") ?? "", /confirmed payment/);
  assert.equal(checkCancel(s1, [pay({ saleId: "s1", status: "pending" })], "Wrong shop"), null, "a pending cheque does not block it");
  assert.equal(checkCancel({ ...s1, status: "cancelled" }, [], "x"), "This sale is already cancelled.");
  assert.equal(cancelledGoodsGo("in_progress"), "salesman");
  assert.equal(cancelledGoodsGo("closed"), "salesman");
  assert.equal(cancelledGoodsGo("reconciled"), "warehouse");
  assert.equal(cancelledGoodsGo(undefined), "warehouse");
});

test("write-offs: from the warehouse, or from a day plan without reducing the warehouse again", () => {
  const product = { id: "p1", name: "Noodles", stockUnits: 10 };
  const input = { units: 4, reason: "damaged" as const, note: "" };
  assert.equal(checkWriteOff(input, product, null, [], []), null);
  assert.equal(checkWriteOff({ ...input, units: 11 }, product, null, [], []), "Only 10 Noodles in the warehouse.");
  assert.equal(checkWriteOff({ ...input, units: 0 }, product, null, [], []), "Enter a whole quantity above zero.");
  const plan = { id: "d1", status: "closed" as const, issued: [{ productId: "p1", units: 24 }] };
  const sold = [sale({ planId: "d1", lines: [{ productId: "p1", quantity: 15, unit: "unit", baseUnits: 15, pricePaisa: 0, totalPaisa: 0 }] })];
  assert.equal(checkWriteOff({ ...input, units: 9 }, { ...product, stockUnits: 0 }, plan, sold, []), null, "the warehouse holding none does not matter on a plan");
  assert.equal(checkWriteOff({ ...input, units: 9 }, product, plan, sold, [{ planId: "d1", productId: "p1", units: 1 }]), "Only 8 Noodles left on that day plan.");
  assert.match(checkWriteOff(input, product, { ...plan, status: "reconciled" }, sold, []) ?? "", /already counted/);
  assert.match(checkWriteOff(input, { ...product, id: "p9" }, plan, sold, []) ?? "", /not issued/);
});

test("sales in a range: confirmed only, cash only, by shop and by salesman", () => {
  const sales = [
    sale({ id: "a", date: "2026-11-04", salesmanId: "u1", shopId: "s1", totalPaisa: 1_000 }),
    sale({ id: "b", date: "2026-11-04", salesmanId: "u2", shopId: "s1", totalPaisa: 3_000 }),
    sale({ id: "c", date: "2026-11-04", salesmanId: "u1", shopId: "s2", totalPaisa: 9_000, status: "cancelled" }),
    sale({ id: "d", date: "2026-11-03", salesmanId: "u1", shopId: "s2", totalPaisa: 7_000 }),
  ];
  const payments = [
    pay({ date: "2026-11-04", salesmanId: "u1", shopId: "s2", amountPaisa: 500 }),
    pay({ id: "q", date: "2026-11-04", salesmanId: "u1", shopId: "s1", method: "cheque", status: "pending", amountPaisa: 800 }),
  ];
  const r = salesInRange({ from: "2026-11-04", to: "2026-11-04" }, sales, payments);
  assert.equal(r.count, 2);
  assert.equal(r.totalPaisa, 4_000);
  assert.equal(r.cashCollectedPaisa, 500);
  assert.deepEqual(r.bySalesman, [{ salesmanId: "u2", count: 1, totalPaisa: 3_000, cashPaisa: 0 }, { salesmanId: "u1", count: 1, totalPaisa: 1_000, cashPaisa: 500 }]);
  assert.deepEqual(r.byShop, [{ shopId: "s1", count: 2, totalPaisa: 4_000, cashPaisa: 0 }, { shopId: "s2", count: 0, totalPaisa: 0, cashPaisa: 500 }]);
});

test("a salesman's history: their sales and payments in the range, newest first", () => {
  const sales = [sale({ id: "a", invoiceNo: 7, date: "2026-11-01", createdAt: "2026-11-01T04:00:00Z", salesmanId: "u1", totalPaisa: 1_000 }), sale({ id: "b", date: "2026-11-02", salesmanId: "u2" })];
  const payments = [pay({ id: "p1", date: "2026-11-01", createdAt: "2026-11-01T06:00:00Z", salesmanId: "u1", method: "cheque", status: "bounced", amountPaisa: 400 }), pay({ id: "p2", date: "2026-10-01", salesmanId: "u1" })];
  const h = salesmanHistory("u1", { from: "2026-11-01", to: "2026-11-04" }, sales, payments);
  assert.deepEqual(h.map((x) => [x.kind, x.id, x.ref, x.status]), [["payment", "p1", "Cheque", "bounced"], ["sale", "a", "Invoice 7", "confirmed"]]);
});

test("shortage over reconciled plans: only shortfalls, valued at the unit price", () => {
  const line = (productId: string, baseUnits: number) => ({ productId, unit: "unit" as const, quantity: baseUnits, baseUnits, pricePaisa: 0, totalPaisa: 0 });
  const plan = (id: string, issued: [string, number][], counted: [string, number][]) =>
    ({ id, issued: issued.map(([productId, units]) => ({ productId, units })), counted: counted.map(([productId, units]) => ({ productId, units })) }) as DayPlan;
  const plans = [plan("d1", [["p1", 10], ["p2", 5]], [["p1", 2], ["p2", 5]]), plan("d2", [["p1", 4]], [["p1", 1]])];
  const sales = [sale({ planId: "d1", lines: [line("p1", 6)] }), sale({ id: "y", planId: "d2", lines: [line("p1", 3)] })];
  const t = shortageTotals(plans, sales, [{ planId: "d1", productId: "p1", units: 1 }], [{ id: "p1", unitPricePaisa: 250 }, { id: "p2", unitPricePaisa: 99 }]);
  // d1: p1 10 − 6 sold − 2 back − 1 written off = 1 short; p2 none. d2: p1 4 − 3 − 1 = 0.
  assert.deepEqual(t, { plans: 2, units: 1, valuePaisa: 250, byProduct: [{ productId: "p1", units: 1, valuePaisa: 250 }] });
});

test("a range of days adds up, and units sold count confirmed sales in the range", () => {
  const line = (productId: string, baseUnits: number) => ({ productId, unit: "unit" as const, quantity: baseUnits, baseUnits, pricePaisa: 0, totalPaisa: 0 });
  const sales = [
    sale({ id: "a", date: "2026-11-02", totalPaisa: 100, lines: [line("p1", 4)] }),
    sale({ id: "b", date: "2026-11-04", totalPaisa: 200, lines: [line("p1", 2), line("p2", 1)] }),
    sale({ id: "c", date: "2026-11-04", status: "cancelled", lines: [line("p1", 50)] }),
    sale({ id: "d", date: "2026-10-01", totalPaisa: 999, lines: [line("p1", 9)] }),
  ];
  const r = salesInRange({ from: "2026-11-01", to: "2026-11-04" }, sales, []);
  assert.deepEqual([r.from, r.to, r.count, r.totalPaisa], ["2026-11-01", "2026-11-04", 2, 300]);
  assert.deepEqual([...unitsSold(sales, { from: "2026-11-01", to: "2026-11-04" })], [["p1", 6], ["p2", 1]]);
});

