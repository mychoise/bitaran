/**
 * Money utilities for Bitaran wholesale marketplace.
 * All monetary amounts in database/API are integer paisa (1 Rupee = 100 Paisa).
 * No floating point math on money.
 */

export function formatMoney(paisa: number | string | bigint): string {
  const p = BigInt(paisa.toString());
  const isNegative = p < 0n;
  const absP = isNegative ? -p : p;

  const rupees = absP / 100n;
  const remainder = absP % 100n;
  const remainderStr = remainder.toString().padStart(2, '0');

  // Format rupees with comma separators: e.g. 1,200 or 12,00,000
  const rupeesStr = rupees.toLocaleString('en-IN');

  const formatted = `Rs ${rupeesStr}.${remainderStr}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Converts a rupee input string or number to integer paisa.
 * E.g., '1200' -> 120000, '1200.50' -> 120050.
 */
export function rupeesToPaisa(rupees: number | string): number {
  if (typeof rupees === 'number') {
    return Math.round(rupees * 100);
  }
  const clean = rupees.trim();
  if (!clean) return 0;
  const parts = clean.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  const frac = parts[1] ? (parts[1] + '00').slice(0, 2) : '00';
  return whole * 100 + parseInt(frac, 10);
}

/**
 * Converts integer paisa to rupee string for form inputs (e.g. 120000 -> "1200" or "1200.50").
 */
export function paisaToRupees(paisa: number | string | bigint): string {
  const p = BigInt(paisa.toString());
  const whole = p / 100n;
  const frac = p % 100n;
  if (frac === 0n) {
    return whole.toString();
  }
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}
