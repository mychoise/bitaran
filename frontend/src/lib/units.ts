// Counts of stock in words: "480 cups", "2 cartons + 17 cups". Stock is always counted in base
// units; the carton equivalent is shown beside it, never instead of it.

import { cartonSplit } from "./api/mock/rules.ts";
import { groupIndian } from "./money.ts";

/** "packet" → "packets", "box" → "boxes", "pouch" → "pouches". Good enough for unit names. */
export function plural(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "1 bottle", "1,200 bottles", "-6 bottles". */
export function countUnits(n: number, unitName: string): string {
  const digits = `${n < 0 ? "-" : ""}${groupIndian(String(Math.abs(n)))}`;
  return `${digits} ${Math.abs(n) === 1 ? unitName : plural(unitName)}`;
}

/** "20 cartons", "2 cartons + 17 cups", "less than a carton". Null when not sold by the carton. */
export function cartonEquivalent(units: number, unitsPerCarton: number | null, unitName: string): string | null {
  const split = cartonSplit(Math.max(0, units), unitsPerCarton);
  if (!split) return null;
  if (split.cartons === 0) return units > 0 ? "less than a carton" : "0 cartons";
  const cartons = `${groupIndian(String(split.cartons))} carton${split.cartons === 1 ? "" : "s"}`;
  return split.loose ? `${cartons} + ${countUnits(split.loose, unitName)}` : cartons;
}
