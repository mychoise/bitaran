/**
 * All monetary values are integer paisa (1 NPR = 100 paisa).
 * Never use floats or decimal strings.
 */

export function isIntegerPaisa(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws if `value` is not a safe integer. Use for internal invariants. */
export function assertIntegerPaisa(
  value: unknown,
  fieldName = 'amount',
): asserts value is number {
  if (!isIntegerPaisa(value)) {
    throw new TypeError(
      `${fieldName} must be an integer paisa value, got ${String(value)}`,
    );
  }
}

/** Sums integer paisa values; throws on any non-integer or on overflow. */
export function sumPaisa(values: readonly number[]): number {
  const total = values.reduce((acc, v, i) => {
    assertIntegerPaisa(v, `values[${i}]`);
    return acc + v;
  }, 0);
  assertIntegerPaisa(total, 'sum');
  return total;
}

/** unit price (paisa) × integer quantity, checked for overflow. */
export function multiplyPaisa(
  unitPricePaisa: number,
  quantity: number,
): number {
  assertIntegerPaisa(unitPricePaisa, 'unitPricePaisa');
  if (!Number.isSafeInteger(quantity)) {
    throw new TypeError(`quantity must be an integer, got ${String(quantity)}`);
  }
  const product = unitPricePaisa * quantity;
  assertIntegerPaisa(product, 'lineTotal');
  return product;
}
