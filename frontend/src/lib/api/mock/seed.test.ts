import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCarton, remainingOnPlan, shopBalance, skuTaken, validPrice } from "./rules.ts";
import { seedDemoData } from "./seed.ts";

const data = seedDemoData("2026-10-14");

test("seed is deterministic for a given day", () => {
  assert.deepEqual(seedDemoData("2026-10-14"), data);
});

test("seed covers what the screens need", () => {
  assert.equal(data.categories.length, 3);
  assert.ok(data.products.length >= 25);
  assert.equal(data.routes.length, 2);
  for (const status of ["planned", "in_progress", "closed", "reconciled"]) assert.ok(data.dayPlans.some((p) => p.status === status), `a ${status} plan`);
  assert.ok(data.sales.length >= 35 && data.sales.length <= 40, `about 40 sales, got ${data.sales.length}`);
  for (const [m, s] of [["cash", "confirmed"], ["cheque", "pending"], ["cheque", "bounced"], ["cheque", "confirmed"], ["online", "pending"], ["online", "confirmed"]])
    assert.ok(data.payments.some((p) => p.method === m && p.status === s), `a ${s} ${m} payment`);
  for (const t of ["salary", "fuel", "khaja", "misc"]) assert.ok(data.expenses.some((e) => e.type === t), `a ${t} expense`);
  for (const f of ["old_photo", "far_from_shop", "duplicate"]) assert.ok(data.photos.some((p) => p.flags.includes(f as never)), `a ${f} photo`);
  assert.ok(data.returns.length >= 3 && data.writeOffs.length >= 2);
});

test("seeded login ids match the login mock accounts", () => {
  for (const id of ["u-owner", "u-manager", "u-salesman", "u-salesman2"]) assert.ok(data.staff.some((s) => s.id === id));
  for (const id of ["s-shop", "s-shop2", "s-shop3"]) assert.ok(data.shops.some((s) => s.id === id && s.hasLogin));
  assert.equal(data.staff.filter((s) => s.role === "owner").length, 1, "one owner per business");
});

test("seed obeys the rules: sequential invoices, priced from products, nothing sold beyond what was issued", () => {
  assert.deepEqual(data.sales.map((s) => s.invoiceNo), data.sales.map((_, i) => i + 1));
  assert.ok(data.sales.some((s) => s.status === "cancelled"));
  for (const sale of data.sales) {
    for (const line of sale.lines) {
      const p = data.products.find((x) => x.id === line.productId)!;
      assert.equal(line.pricePaisa, line.unit === "carton" ? p.cartonPricePaisa : p.unitPricePaisa);
      assert.ok(Number.isInteger(line.totalPaisa));
    }
  }
  for (const plan of data.dayPlans) for (const left of remainingOnPlan(plan, data.sales).values()) assert.ok(left >= 0, `plan ${plan.id} oversold`);
  for (const plan of data.dayPlans.filter((p) => p.status === "in_progress")) assert.equal(data.dayPlans.filter((p) => p.salesmanId === plan.salesmanId && p.status === "in_progress").length, 1);
});

test("returns never restock damaged or expired goods, and balances are whole paisa", () => {
  for (const r of data.returns) for (const l of r.lines) if (l.reason !== "other") assert.equal(l.restocked, false);
  for (const shop of data.shops) assert.ok(Number.isSafeInteger(shopBalance(shop, data.sales, data.payments, data.returns).balancePaisa));
});

test("seeded products obey the product rules", () => {
  for (const p of data.products) {
    assert.equal(skuTaken(data.products, p.sku, p.id), false, `unique SKU ${p.sku}`);
    assert.equal(checkCarton(p), null, p.name);
    assert.ok(validPrice(p.unitPricePaisa) && validPrice(p.costPricePaisa!), p.name);
    assert.ok(Number.isInteger(p.stockUnits) && p.stockUnits >= 0, p.name);
    assert.ok(data.categories.some((c) => c.id === p.categoryId), p.name);
  }
});
