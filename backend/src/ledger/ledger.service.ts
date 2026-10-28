import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sum } from 'drizzle-orm';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import {
  payments,
  retailClients,
  saleReturns,
  sales,
} from '../database/schema/index.js';

const clientNotFound = () =>
  new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found'));

export interface StatementEntry {
  date: string;
  type: 'sale' | 'payment' | 'return';
  id: string;
  reference: string;
  /** Adds to what the shop owes. */
  debitPaisa: number;
  /** Takes away from what the shop owes. */
  creditPaisa: number;
  /** What the shop owes after this entry. */
  balancePaisa: number;
}

/**
 * A shop's account: the balance broken down, and a statement. Follows the one
 * balance definition in BalanceService (opening + confirmed sales - confirmed
 * payments - returns); the two are tested to agree.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async summary(businessId: string, clientId: string) {
    const client = await this.client(businessId, clientId);

    const [confirmedSales, [paid], [clearing], [returned]] = await Promise.all([
      this.db
        .select({
          id: sales.id,
          invoiceNumber: sales.invoiceNumber,
          saleDate: sales.saleDate,
          dueDate: sales.dueDate,
          totalPaisa: sales.totalPaisa,
        })
        .from(sales)
        .where(
          and(
            eq(sales.businessId, businessId),
            eq(sales.clientId, clientId),
            eq(sales.status, 'confirmed'),
          ),
        )
        .orderBy(asc(sales.saleDate), asc(sales.invoiceNumber)),
      this.db
        .select({ total: sum(payments.amountPaisa).mapWith(Number) })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, businessId),
            eq(payments.clientId, clientId),
            eq(payments.status, 'confirmed'),
          ),
        ),
      this.db
        .select({ total: sum(payments.amountPaisa).mapWith(Number) })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, businessId),
            eq(payments.clientId, clientId),
            eq(payments.status, 'pending'),
            inArray(payments.method, ['cheque', 'online']),
          ),
        ),
      this.db
        .select({ total: sum(saleReturns.totalPaisa).mapWith(Number) })
        .from(saleReturns)
        .where(
          and(
            eq(saleReturns.businessId, businessId),
            eq(saleReturns.clientId, clientId),
          ),
        ),
    ]);

    const opening = client.openingBalancePaisa;
    const totalSales = confirmedSales.reduce((n, s) => n + s.totalPaisa, 0);
    const totalPayments = paid.total ?? 0;
    const totalReturns = returned.total ?? 0;
    const balance = opening + totalSales - totalPayments - totalReturns;

    // Overdue: money in (payments, returns, and any opening credit) settles
    // the oldest debt first: the opening balance, then sales by date and
    // invoice number. Whatever is left unpaid on a sale past its due date is
    // overdue. A sale with no due date is never overdue.
    let pool = totalPayments + totalReturns + Math.max(0, -opening);
    pool -= Math.min(pool, Math.max(0, opening));
    const today = nepalToday();
    const overdueSales = [];
    for (const s of confirmedSales) {
      const applied = Math.min(pool, s.totalPaisa);
      pool -= applied;
      const unpaid = s.totalPaisa - applied;
      if (unpaid > 0 && s.dueDate !== null && s.dueDate < today) {
        overdueSales.push({
          saleId: s.id,
          invoiceNumber: s.invoiceNumber,
          saleDate: s.saleDate,
          dueDate: s.dueDate,
          unpaidPaisa: unpaid,
        });
      }
    }

    return {
      clientId,
      asOf: today,
      openingBalancePaisa: opening,
      totalSalesPaisa: totalSales,
      totalPaymentsPaisa: totalPayments,
      totalReturnsPaisa: totalReturns,
      /** Signed: positive = the shop owes; negative = the shop is in credit. */
      balancePaisa: balance,
      owedPaisa: Math.max(0, balance),
      creditPaisa: Math.max(0, -balance),
      creditLimitPaisa: client.creditLimitPaisa,
      /** Pending cheques and online transfers; not yet off the balance. */
      inClearingPaisa: clearing.total ?? 0,
      overduePaisa: overdueSales.reduce((n, s) => n + s.unpaidPaisa, 0),
      overdueSales,
    };
  }

  /**
   * Sales, payments and returns between `from` and `to` (Nepal dates,
   * inclusive), oldest first, each with the balance after it. Only what
   * counts towards the balance appears: confirmed sales and payments, and
   * returns. A payment is dated by when it was received.
   */
  async statement(
    businessId: string,
    clientId: string,
    range: { from?: string; to?: string },
  ) {
    if (range.from && range.to && range.from > range.to) {
      throw new BadRequestException(
        errorBody('INVALID_DATE_RANGE', '`from` must not be after `to`'),
      );
    }
    const client = await this.client(businessId, clientId);

    const [saleRows, paymentRows, returnRows] = await Promise.all([
      this.db
        .select({
          id: sales.id,
          invoiceNumber: sales.invoiceNumber,
          date: sales.saleDate,
          at: sales.createdAt,
          amount: sales.totalPaisa,
        })
        .from(sales)
        .where(
          and(
            eq(sales.businessId, businessId),
            eq(sales.clientId, clientId),
            eq(sales.status, 'confirmed'),
          ),
        ),
      this.db
        .select({
          id: payments.id,
          method: payments.method,
          chequeNumber: payments.chequeNumber,
          referenceNo: payments.referenceNo,
          at: payments.receivedAt,
          amount: payments.amountPaisa,
        })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, businessId),
            eq(payments.clientId, clientId),
            eq(payments.status, 'confirmed'),
          ),
        ),
      this.db
        .select({
          id: saleReturns.id,
          date: saleReturns.returnDate,
          at: saleReturns.createdAt,
          amount: saleReturns.totalPaisa,
        })
        .from(saleReturns)
        .where(
          and(
            eq(saleReturns.businessId, businessId),
            eq(saleReturns.clientId, clientId),
          ),
        ),
    ]);

    const all = [
      ...saleRows.map((s) => ({
        date: s.date,
        at: s.at,
        type: 'sale' as const,
        id: s.id,
        reference: `Invoice #${s.invoiceNumber}`,
        debitPaisa: s.amount,
        creditPaisa: 0,
      })),
      ...paymentRows.map((p) => ({
        date: nepalToday(p.at),
        at: p.at,
        type: 'payment' as const,
        id: p.id,
        reference: paymentReference(p),
        debitPaisa: 0,
        creditPaisa: p.amount,
      })),
      ...returnRows.map((r) => ({
        date: r.date,
        at: r.at,
        type: 'return' as const,
        id: r.id,
        reference: 'Return',
        debitPaisa: 0,
        creditPaisa: r.amount,
      })),
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.at.getTime() - b.at.getTime() ||
        a.id.localeCompare(b.id),
    );

    let balance = client.openingBalancePaisa;
    const entries: StatementEntry[] = [];
    let openingBalance = balance;
    for (const e of all) {
      if (range.to && e.date > range.to) break;
      balance += e.debitPaisa - e.creditPaisa;
      if (range.from && e.date < range.from) {
        openingBalance = balance;
        continue;
      }
      entries.push({
        date: e.date,
        type: e.type,
        id: e.id,
        reference: e.reference,
        debitPaisa: e.debitPaisa,
        creditPaisa: e.creditPaisa,
        balancePaisa: balance,
      });
    }

    return {
      clientId,
      from: range.from ?? null,
      to: range.to ?? null,
      /** Owed at the start of the range (the account's opening balance if none). */
      openingBalancePaisa: openingBalance,
      entries,
      closingBalancePaisa: balance,
    };
  }

  /** The shop's business, for a shop token (which carries only its id). */
  async businessOf(clientId: string): Promise<string> {
    const [row] = await this.db
      .select({ businessId: retailClients.businessId })
      .from(retailClients)
      .where(eq(retailClients.id, clientId));
    if (!row) throw clientNotFound();
    return row.businessId;
  }

  private async client(businessId: string, clientId: string) {
    const [row] = await this.db
      .select({
        openingBalancePaisa: retailClients.openingBalancePaisa,
        creditLimitPaisa: retailClients.creditLimitPaisa,
      })
      .from(retailClients)
      .where(
        and(
          eq(retailClients.id, clientId),
          eq(retailClients.businessId, businessId),
        ),
      );
    if (!row) throw clientNotFound();
    return row;
  }
}

function paymentReference(p: {
  method: string;
  chequeNumber: string | null;
  referenceNo: string | null;
}): string {
  if (p.method === 'cheque') return `Cheque ${p.chequeNumber ?? ''}`.trim();
  if (p.method === 'online') {
    return `Online ${p.referenceNo ?? ''}`.trim();
  }
  return 'Cash';
}
