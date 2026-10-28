import { UnprocessableEntityException } from '@nestjs/common';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { MAX_STOCK } from './stock.service.js';

/**
 * Units a quantity can be expressed in on a stock line: the product's own base
 * unit (piece, packet, ... whatever products.unit says) or whole cartons of
 * products.units_per_carton base units. Stored as-is in the line's `unit`.
 */
export const STOCK_UNITS = ['base', 'carton'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

/** Converts a line quantity to base units; stock_quantity is in base units. */
export function toBaseUnits(
  product: { id: string; unitsPerCarton: number | null },
  unit: StockUnit,
  quantity: number,
): number {
  if (unit === 'base') return quantity;
  if (!product.unitsPerCarton) {
    throw new UnprocessableEntityException(
      errorBody(
        'NO_CARTON_SIZE',
        'This product has no carton size, so it cannot be issued in cartons',
        [{ productId: product.id }],
      ),
    );
  }
  const base = quantity * product.unitsPerCarton;
  if (base > MAX_STOCK) {
    throw new UnprocessableEntityException(
      errorBody('QUANTITY_TOO_LARGE', 'Quantity is too large', [
        { productId: product.id },
      ]),
    );
  }
  return base;
}
