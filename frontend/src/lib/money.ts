// Money is always an integer number of paisa (1 rupee = 100 paisa). Never a float.
// Display uses Nepali/Indian digit grouping: Rs 1,23,456.00 (lakh, crore).

export type Paisa = number;

function assertPaisa(value: number): void {
  if (!Number.isSafeInteger(value)) throw new Error(`Money must be a whole number of paisa, got ${value}`);
}

/** 123456 -> "1,23,456": last three digits, then groups of two. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

/** The amount without a sign: 1234550 -> "12,345.50". */
export function formatAmount(paisa: Paisa): string {
  assertPaisa(paisa);
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${groupIndian(String(rupees))}.${String(rest).padStart(2, "0")}`;
}

/** "Rs 12,345.50", or "−Rs 12,345.50" for a negative amount (rare: use formatBalance for balances). */
export function formatMoney(paisa: Paisa): string {
  return `${paisa < 0 ? "−" : ""}Rs ${formatAmount(paisa)}`;
}

/**
 * A shop's balance: what it owes, or "Credit Rs X" when the business owes the shop.
 * Never shown as a minus number.
 */
export function formatBalance(paisa: Paisa): string {
  assertPaisa(paisa);
  return paisa < 0 ? `Credit Rs ${formatAmount(paisa)}` : `Rs ${formatAmount(paisa)}`;
}

/** Rupees as typed by a person ("1,250.5") to paisa (125050), or null if it is not a valid amount. */
export function parseRupees(input: string): Paisa | null {
  const clean = input.replace(/[,\s]/g, "").replace(/^Rs\.?/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const paisa = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paisa) ? paisa : null;
}

/** Sum of paisa values, staying exact. */
export function sumPaisa(values: readonly Paisa[]): Paisa {
  let total = 0;
  for (const v of values) {
    assertPaisa(v);
    total += v;
  }
  assertPaisa(total);
  return total;
}
