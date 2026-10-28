import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  payments,
  retailClients,
  saleReturns,
  sales,
} from '../database/schema/index.js';

/**
 * What a shop owes, in paisa. The one definition of a balance:
 *
 *   opening_balance + confirmed sales - confirmed payments - returns
 *
 * Cancelled sales do not count. Payments count only once confirmed: a pending
 * cheque does not reduce the balance until it clears, and a bounced one never
 * does. Positive means the shop owes the business.
 */
@Injectable()
export class BalanceService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async balancesOf(
    businessId: string,
    clientIds: string[],
    executor: Database | Transaction = this.db,
  ): Promise<Map<string, number>> {
    if (!clientIds.length) return new Map();
    // Each total is grouped per shop and joined, rather than written as a
    // correlated subquery, so every column is unambiguously qualified.
    const sold = executor
      .select({
        clientId: sales.clientId,
        amount: sql<string>`sum(${sales.totalPaisa})`.as('sold'),
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          inArray(sales.clientId, clientIds),
          eq(sales.status, 'confirmed'),
        ),
      )
      .groupBy(sales.clientId)
      .as('sold');
    const paid = executor
      .select({
        clientId: payments.clientId,
        amount: sql<string>`sum(${payments.amountPaisa})`.as('paid'),
      })
      .from(payments)
      .where(
        and(
          eq(payments.businessId, businessId),
          inArray(payments.clientId, clientIds),
          eq(payments.status, 'confirmed'),
        ),
      )
      .groupBy(payments.clientId)
      .as('paid');
    const returned = executor
      .select({
        clientId: saleReturns.clientId,
        amount: sql<string>`sum(${saleReturns.totalPaisa})`.as('returned'),
      })
      .from(saleReturns)
      .where(
        and(
          eq(saleReturns.businessId, businessId),
          inArray(saleReturns.clientId, clientIds),
        ),
      )
      .groupBy(saleReturns.clientId)
      .as('returned');

    const rows = await executor
      .select({
        id: retailClients.id,
        balance: sql<number>`(
          ${retailClients.openingBalancePaisa}
          + coalesce(${sold.amount}, 0)
          - coalesce(${paid.amount}, 0)
          - coalesce(${returned.amount}, 0)
        )::bigint`.mapWith(Number),
      })
      .from(retailClients)
      .leftJoin(sold, eq(sold.clientId, retailClients.id))
      .leftJoin(paid, eq(paid.clientId, retailClients.id))
      .leftJoin(returned, eq(returned.clientId, retailClients.id))
      .where(
        and(
          eq(retailClients.businessId, businessId),
          inArray(retailClients.id, clientIds),
        ),
      );
    return new Map(rows.map((r) => [r.id, r.balance]));
  }

  async balanceOf(
    businessId: string,
    clientId: string,
    executor: Database | Transaction = this.db,
  ): Promise<number> {
    const map = await this.balancesOf(businessId, [clientId], executor);
    return map.get(clientId) ?? 0;
  }
}
