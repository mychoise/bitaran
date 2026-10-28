import { and, eq, sum } from 'drizzle-orm';
import type { Database, Transaction } from '../database/database.types.js';
import {
  dayPlanStock,
  products,
  saleItems,
  sales,
  stockWriteOffs,
} from '../database/schema/index.js';
import { toBaseUnits } from '../stock/units.js';
import type { StockUnit } from '../stock/units.js';

/** Base units per product id. */
export type BaseUnits = Map<string, number>;

interface Row {
  productId: string;
  unit: string;
  quantity: number | null;
  unitsPerCarton: number | null;
}

/** Sums rows of (product, unit, quantity) into base units per product. */
function toBase(rows: Row[]): BaseUnits {
  const out: BaseUnits = new Map();
  for (const r of rows) {
    if (r.quantity === null) continue;
    const base = toBaseUnits(
      { id: r.productId, unitsPerCarton: r.unitsPerCarton },
      r.unit as StockUnit,
      r.quantity,
    );
    out.set(r.productId, (out.get(r.productId) ?? 0) + base);
  }
  return out;
}

/**
 * How a plan's van stock moved, per product in base units. The one place
 * this is worked out, used by sales (what is left to sell) and by the
 * end-of-day report.
 *
 * Cartons are converted with each product's current carton size; lines do
 * not store their base-unit quantity.
 */
export async function planStockMovements(
  executor: Database | Transaction,
  businessId: string,
  planId: string,
): Promise<{
  issued: BaseUnits;
  returned: BaseUnits;
  counted: BaseUnits;
  sold: BaseUnits;
  writtenOff: BaseUnits;
}> {
  const [lines, sold, writtenOff] = await Promise.all([
    executor
      .select({
        productId: dayPlanStock.productId,
        unit: dayPlanStock.unit,
        issued: dayPlanStock.quantityIssued,
        returned: dayPlanStock.quantityReturned,
        counted: dayPlanStock.quantityCounted,
        unitsPerCarton: products.unitsPerCarton,
      })
      .from(dayPlanStock)
      .innerJoin(products, eq(products.id, dayPlanStock.productId))
      .where(eq(dayPlanStock.dayPlanId, planId)),
    // Only confirmed sales: a cancelled sale gives its stock back.
    executor
      .select({
        productId: saleItems.productId,
        unit: saleItems.unit,
        quantity: sum(saleItems.quantity).mapWith(Number),
        unitsPerCarton: products.unitsPerCarton,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.dayPlanId, planId),
          eq(sales.status, 'confirmed'),
        ),
      )
      .groupBy(saleItems.productId, saleItems.unit, products.unitsPerCarton),
    executor
      .select({
        productId: stockWriteOffs.productId,
        unit: stockWriteOffs.unit,
        quantity: sum(stockWriteOffs.quantity).mapWith(Number),
        unitsPerCarton: products.unitsPerCarton,
      })
      .from(stockWriteOffs)
      .innerJoin(products, eq(products.id, stockWriteOffs.productId))
      .where(
        and(
          eq(stockWriteOffs.businessId, businessId),
          eq(stockWriteOffs.dayPlanId, planId),
        ),
      )
      .groupBy(
        stockWriteOffs.productId,
        stockWriteOffs.unit,
        products.unitsPerCarton,
      ),
  ]);
  return {
    issued: toBase(lines.map((l) => ({ ...l, quantity: l.issued }))),
    returned: toBase(lines.map((l) => ({ ...l, quantity: l.returned }))),
    counted: toBase(lines.map((l) => ({ ...l, quantity: l.counted }))),
    sold: toBase(sold),
    writtenOff: toBase(writtenOff),
  };
}

/**
 * Shortage in base units: what should be back but is not.
 *
 *   issued - sold - (counted by manager, else returned by salesman) - written off
 *
 * Positive = missing; negative = more came back than expected. Null until
 * the salesman has reported returns.
 */
export function shortageOf(m: {
  issued: number;
  sold: number;
  returned: number | null;
  counted: number | null;
  writtenOff: number;
}): number | null {
  const back = m.counted ?? m.returned;
  return back === null ? null : m.issued - m.sold - back - m.writtenOff;
}

/**
 * Base units of each product still in the van: issued, less confirmed sales,
 * less write-offs. What a sale or a write-off on the plan may still take.
 */
export function vanStockLeft(m: {
  issued: BaseUnits;
  sold: BaseUnits;
  writtenOff: BaseUnits;
}): BaseUnits {
  return new Map(
    [...m.issued].map(([pid, n]) => [
      pid,
      n - (m.sold.get(pid) ?? 0) - (m.writtenOff.get(pid) ?? 0),
    ]),
  );
}
