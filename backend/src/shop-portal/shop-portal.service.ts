import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import {
  payments,
  products,
  retailClients,
  saleItems,
  saleReturnItems,
  saleReturns,
  sales,
  users,
} from '../database/schema/index.js';
import type {
  ShopInvoicesQueryDto,
  ShopPaymentsQueryDto,
  ShopRangeQueryDto,
} from './dto/shop-portal.dto.js';

const shopNotFound = () =>
  new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found'));
// Another shop's invoice answers exactly like one that does not exist.
const invoiceNotFound = () =>
  new NotFoundException(errorBody('SALE_NOT_FOUND', 'Invoice not found'));

/** Confirmed payments made against a sale. */
const paidOn = sql<number>`coalesce((
  select sum(p.amount_paisa) from payments p
  where p.sale_id = ${sales.id} and p.status = 'confirmed'
), 0)`.mapWith(Number);

/**
 * What a logged-in shop sees of its own invoices, payments and returns. The
 * shop is always the token's subject: no id is taken from the request. Only
 * what the shop itself may see is selected: selling prices, never cost; no
 * plan, visit or staff ids; no payment proof images.
 */
@Injectable()
export class ShopPortalService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async invoices(clientId: string, query: ShopInvoicesQueryDto) {
    const businessId = await this.businessOf(clientId);
    const filters: SQL[] = [
      eq(sales.businessId, businessId),
      eq(sales.clientId, clientId),
    ];
    if (query.status) filters.push(eq(sales.status, query.status));
    if (query.from) filters.push(gte(sales.saleDate, query.from));
    if (query.to) filters.push(lte(sales.saleDate, query.to));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(this.invoiceColumns())
        .from(sales)
        .innerJoin(users, eq(users.id, sales.salesmanId))
        .where(where)
        .orderBy(desc(sales.invoiceNumber))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(sales).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** One invoice with its lines and the payments made against it. */
  async invoice(clientId: string, saleId: string) {
    const businessId = await this.businessOf(clientId);
    const [sale] = await this.db
      .select(this.invoiceColumns())
      .from(sales)
      .innerJoin(users, eq(users.id, sales.salesmanId))
      .where(
        and(
          eq(sales.id, saleId),
          eq(sales.businessId, businessId),
          eq(sales.clientId, clientId),
        ),
      );
    if (!sale) throw invoiceNotFound();

    const [items, paid] = await Promise.all([
      this.db
        .select({
          productName: saleItems.productName,
          /** The product's base unit name, e.g. "packet". */
          baseUnit: products.unit,
          unit: saleItems.unit,
          quantity: saleItems.quantity,
          unitPricePaisa: saleItems.unitPricePaisa,
          lineTotalPaisa: saleItems.lineTotalPaisa,
        })
        .from(saleItems)
        .leftJoin(products, eq(products.id, saleItems.productId))
        .where(eq(saleItems.saleId, saleId))
        .orderBy(asc(saleItems.productName), asc(saleItems.unit)),
      this.db
        .select({
          method: payments.method,
          status: payments.status,
          amountPaisa: payments.amountPaisa,
          receivedAt: payments.receivedAt,
        })
        .from(payments)
        .where(
          and(eq(payments.saleId, saleId), eq(payments.clientId, clientId)),
        )
        .orderBy(asc(payments.receivedAt)),
    ]);
    return {
      ...sale,
      subtotalPaisa: sale.totalPaisa + sale.discountPaisa,
      items,
      payments: paid,
    };
  }

  /** Every payment the shop made, pending and bounced ones included. */
  async payments(clientId: string, query: ShopPaymentsQueryDto) {
    const businessId = await this.businessOf(clientId);
    const filters: SQL[] = [
      eq(payments.businessId, businessId),
      eq(payments.clientId, clientId),
    ];
    if (query.status) filters.push(eq(payments.status, query.status));
    // Dates are Nepal calendar days of when the money was received.
    const receivedOn = sql`(${payments.receivedAt} at time zone 'Asia/Kathmandu')::date`;
    if (query.from) filters.push(sql`${receivedOn} >= ${query.from}`);
    if (query.to) filters.push(sql`${receivedOn} <= ${query.to}`);
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          method: payments.method,
          status: payments.status,
          amountPaisa: payments.amountPaisa,
          receivedAt: payments.receivedAt,
          chequeNumber: payments.chequeNumber,
          chequeBank: payments.chequeBank,
          chequeDate: payments.chequeDate,
          referenceNo: payments.referenceNo,
          saleId: payments.saleId,
          invoiceNumber: sales.invoiceNumber,
        })
        .from(payments)
        .leftJoin(sales, eq(sales.id, payments.saleId))
        .where(where)
        .orderBy(desc(payments.receivedAt), desc(payments.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(payments).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** Goods the shop sent back, each with its lines and what it credited. */
  async returns(clientId: string, query: ShopRangeQueryDto) {
    const businessId = await this.businessOf(clientId);
    const filters: SQL[] = [
      eq(saleReturns.businessId, businessId),
      eq(saleReturns.clientId, clientId),
    ];
    if (query.from) filters.push(gte(saleReturns.returnDate, query.from));
    if (query.to) filters.push(lte(saleReturns.returnDate, query.to));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: saleReturns.id,
          returnDate: saleReturns.returnDate,
          totalPaisa: saleReturns.totalPaisa,
          createdAt: saleReturns.createdAt,
        })
        .from(saleReturns)
        .where(where)
        .orderBy(desc(saleReturns.returnDate), desc(saleReturns.createdAt))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(saleReturns).where(where),
    ]);
    const items = rows.length
      ? await this.db
          .select({
            saleReturnId: saleReturnItems.saleReturnId,
            productName: saleReturnItems.productName,
            baseUnit: products.unit,
            unit: saleReturnItems.unit,
            quantity: saleReturnItems.quantity,
            reason: saleReturnItems.reason,
            lineTotalPaisa: saleReturnItems.lineTotalPaisa,
          })
          .from(saleReturnItems)
          .leftJoin(products, eq(products.id, saleReturnItems.productId))
          .where(
            inArray(
              saleReturnItems.saleReturnId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(saleReturnItems.productName))
      : [];
    const data = rows.map((r) => ({
      ...r,
      items: items
        .filter((i) => i.saleReturnId === r.id)
        .map((i) => ({
          productName: i.productName,
          baseUnit: i.baseUnit,
          unit: i.unit,
          quantity: i.quantity,
          reason: i.reason,
          lineTotalPaisa: i.lineTotalPaisa,
        })),
    }));
    return buildPaginatedResult(data, total, query);
  }

  private invoiceColumns() {
    return {
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      saleDate: sales.saleDate,
      dueDate: sales.dueDate,
      status: sales.status,
      cancelReason: sales.cancelReason,
      discountPaisa: sales.discountPaisa,
      totalPaisa: sales.totalPaisa,
      createdAt: sales.createdAt,
      paidPaisa: paidOn,
      salesman: { fullName: users.fullName },
    };
  }

  /** The shop's business: a shop token carries only the shop's id. */
  private async businessOf(clientId: string): Promise<string> {
    const [row] = await this.db
      .select({ businessId: retailClients.businessId })
      .from(retailClients)
      .where(eq(retailClients.id, clientId));
    if (!row) throw shopNotFound();
    return row.businessId;
  }
}
