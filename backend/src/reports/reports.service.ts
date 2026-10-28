import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, isNotNull, lte, sql, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { products, users } from '../database/schema/index.js';
import {
  HistoryQueryDto,
  MAX_ANALYTICS_DAYS,
  ReportRangeQueryDto,
} from './dto/report.dto.js';

const fail = {
  notOwn: () =>
    new ForbiddenException(
      errorBody('FORBIDDEN', 'Salesmen may see only their own reports'),
    ),
  userNotFound: () =>
    new NotFoundException(
      errorBody('USER_NOT_FOUND', 'Staff member not found'),
    ),
  badRange: () =>
    new BadRequestException(
      errorBody('INVALID_DATE_RANGE', '`from` must not be after `to`'),
    ),
  rangeTooLong: () =>
    new BadRequestException(
      errorBody(
        'DATE_RANGE_TOO_LONG',
        `Analytics cover at most ${MAX_ANALYTICS_DAYS} days`,
      ),
    ),
};

const PAYMENT_METHODS = ['cash', 'cheque', 'online'] as const;
const TOP_PRODUCTS = 10;

// ---------- SQL fragments ----------
//
// Reports are written as SQL so every figure is aggregated in the database.
// Who a figure belongs to:
//   - sales: sales.salesman_id;
//   - payments and returns: the salesman whose day plan they were recorded on
//     (as the end-of-day cash count does). A salesman can only record on his
//     own plan; a manager may record on one too. Office records with no plan
//     belong to no salesman.
// Payments are dated by when they were received, in Nepal time.

/** Midnight at the start of a Nepal date, as a timestamptz. */
const nepalStart = (date: string) =>
  sql`(${date}::date::timestamp at time zone 'Asia/Kathmandu')`;
/** Midnight at the end of a Nepal date (the start of the next day). */
const nepalEnd = (date: string) =>
  sql`((${date}::date + 1)::timestamp at time zone 'Asia/Kathmandu')`;
/** A range on payments.received_at that its indexes can use. */
const receivedIn = (from: string, to: string) =>
  sql`p.received_at >= ${nepalStart(from)} and p.received_at < ${nepalEnd(to)}`;
const receivedOn = sql`(p.received_at at time zone 'Asia/Kathmandu')::date`;
/** Plans of a salesman: how his payments and returns are found. */
const plansOf = (salesmanId: string) =>
  sql`(select dp.id from day_plans dp where dp.salesman_id = ${salesmanId})`;
/** A quantity in a product's base unit (`pr` is the products row). */
const base = (quantity: SQL, unit: SQL) =>
  sql`case when ${unit} = 'carton' then ${quantity} * pr.units_per_carton else ${quantity} end`;

/** pg returns bigint and numeric as strings. */
const num = (v: unknown): number => (v === null ? 0 : Number(v));

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private async rows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
    return (await this.db.execute(query)).rows as T[];
  }

  // ---------- history ----------

  /**
   * Every sale (any status) and payment (any status) of a salesman between
   * two Nepal dates, newest first. Sales are dated by sale_date and ordered
   * by when they were made; payments by when they were received.
   */
  async history(
    actor: StaffTokenPayload,
    salesmanId: string,
    query: HistoryQueryDto,
  ) {
    const salesman = await this.salesman(actor, salesmanId);
    assertRange(query);
    const entries = sql`
      select 'sale' as kind, s.id, s.created_at as at, s.sale_date as date,
        s.client_id, s.total_paisa as amount_paisa, s.status::text as status,
        null::text as method, s.invoice_number as invoice_number,
        null::text as reference
      from sales s
      where s.business_id = ${actor.businessId}
        and s.salesman_id = ${salesmanId}
        and s.sale_date between ${query.from} and ${query.to}
      union all
      select 'payment', p.id, p.received_at, ${receivedOn}, p.client_id,
        p.amount_paisa, p.status::text, p.method::text, null,
        coalesce(p.cheque_number, p.reference_no)
      from payments p
      where p.business_id = ${actor.businessId}
        and p.day_plan_id in ${plansOf(salesmanId)}
        and ${receivedIn(query.from, query.to)}`;

    const [page, [{ total }]] = await Promise.all([
      this.rows<{
        kind: 'sale' | 'payment';
        id: string;
        at: Date;
        date: string;
        client_id: string;
        client_name: string;
        amount_paisa: string;
        status: string;
        method: string | null;
        invoice_number: number | null;
        reference: string | null;
      }>(sql`
        select e.*, c.name as client_name
        from (${entries}) e
        join retail_clients c on c.id = e.client_id
        order by e.at desc, e.id desc
        limit ${query.limit} offset ${getOffset(query)}`),
      this.rows<{ total: number }>(
        sql`select count(*)::int as total from (${entries}) e`,
      ),
    ]);
    const data = page.map((r) => ({
      kind: r.kind,
      id: r.id,
      at: new Date(r.at).toISOString(),
      date: r.date,
      shop: { id: r.client_id, name: r.client_name },
      amountPaisa: num(r.amount_paisa),
      status: r.status,
      ...(r.kind === 'sale'
        ? { invoiceNumber: r.invoice_number }
        : { method: r.method, reference: r.reference }),
    }));
    return { salesman, ...buildPaginatedResult(data, total, query) };
  }

  // ---------- today ----------

  /**
   * Today (Nepal date): confirmed sales and confirmed cash received, in total
   * and per shop. Salesmen get their own day; managers and owners get the
   * business, plus a line per salesman (and one with no salesman, for cash
   * taken at the office).
   */
  async today(actor: StaffTokenPayload) {
    const date = nepalToday();
    const own = actor.role === 'salesman';
    const salesBy = own ? sql`and s.salesman_id = ${actor.sub}` : sql``;
    const cashBy = own ? sql`and dp.salesman_id = ${actor.sub}` : sql``;
    // One row per (shop, salesman). Shops are reached through the business,
    // so the per-shop indexes on sales and payments serve both views.
    const grain = await this.rows<{
      client_id: string;
      client_name: string;
      salesman_id: string | null;
      salesman_name: string | null;
      sales_count: number;
      sales_paisa: string;
      cash_paisa: string;
    }>(sql`
      with sold as (
        select s.client_id, s.salesman_id, count(*)::int as n,
          sum(s.total_paisa) as paisa
        from sales s
        join retail_clients c on c.id = s.client_id
        where c.business_id = ${actor.businessId}
          and s.sale_date = ${date}
          and s.status = 'confirmed' ${salesBy}
        group by s.client_id, s.salesman_id
      ), cash as (
        select p.client_id, dp.salesman_id, sum(p.amount_paisa) as paisa
        from payments p
        join retail_clients c on c.id = p.client_id
        left join day_plans dp on dp.id = p.day_plan_id
        where c.business_id = ${actor.businessId}
          and p.method = 'cash' and p.status = 'confirmed'
          and ${receivedIn(date, date)} ${cashBy}
        group by p.client_id, dp.salesman_id
      )
      select k.client_id, c.name as client_name,
        k.salesman_id, u.full_name as salesman_name,
        coalesce(sold.n, 0) as sales_count,
        coalesce(sold.paisa, 0)::bigint as sales_paisa,
        coalesce(cash.paisa, 0)::bigint as cash_paisa
      from (
        select client_id, salesman_id from sold
        union
        select client_id, salesman_id from cash
      ) k
      join retail_clients c on c.id = k.client_id
      left join users u on u.id = k.salesman_id
      left join sold on sold.client_id = k.client_id
        and sold.salesman_id is not distinct from k.salesman_id
      left join cash on cash.client_id = k.client_id
        and cash.salesman_id is not distinct from k.salesman_id
      order by c.name, c.id`);

    // Folding the already-aggregated rows into shops and salesmen.
    const figures = () => ({
      salesCount: 0,
      salesPaisa: 0,
      cashCollectedPaisa: 0,
    });
    const total = figures();
    const shops = new Map<
      string,
      { shop: { id: string; name: string } } & ReturnType<typeof figures>
    >();
    const salesmen = new Map<
      string | null,
      { salesman: { id: string; fullName: string } | null } & ReturnType<
        typeof figures
      >
    >();
    for (const r of grain) {
      const shop = shops.get(r.client_id) ?? {
        shop: { id: r.client_id, name: r.client_name },
        ...figures(),
      };
      shops.set(r.client_id, shop);
      const man = salesmen.get(r.salesman_id) ?? {
        salesman: r.salesman_id
          ? { id: r.salesman_id, fullName: r.salesman_name! }
          : null,
        ...figures(),
      };
      salesmen.set(r.salesman_id, man);
      for (const f of [total, shop, man]) {
        f.salesCount += r.sales_count;
        f.salesPaisa += num(r.sales_paisa);
        f.cashCollectedPaisa += num(r.cash_paisa);
      }
    }
    return {
      date,
      ...total,
      shops: [...shops.values()],
      ...(!own && {
        salesmen: [...salesmen.values()].sort((a, b) =>
          (a.salesman?.fullName ?? '￿').localeCompare(
            b.salesman?.fullName ?? '￿',
          ),
        ),
      }),
    };
  }

  // ---------- analytics ----------

  /**
   * A salesman's figures between two Nepal dates. Sales are confirmed ones
   * only. Payments "collected" exclude bounced ones; pending cheques and
   * transfers count, and are shown separately. Shortage covers his closed and
   * reconciled plans dated in the range: per plan and product, what should
   * have come back but did not (surpluses do not offset it), valued at each
   * product's current price.
   */
  async analytics(
    actor: StaffTokenPayload,
    salesmanId: string,
    query: ReportRangeQueryDto,
  ) {
    const salesman = await this.salesman(actor, salesmanId);
    assertRange(query, MAX_ANALYTICS_DAYS);
    const { from, to } = query;
    const b = actor.businessId;
    const salesIn = sql`s.business_id = ${b} and s.salesman_id = ${salesmanId}
      and s.status = 'confirmed' and s.sale_date between ${from} and ${to}`;
    const collectedIn = sql`p.business_id = ${b}
      and p.day_plan_id in ${plansOf(salesmanId)}
      and p.status <> 'bounced' and ${receivedIn(from, to)}`;

    const [[totals], methods, [returns], [shortage], days, shops, top] =
      await Promise.all([
        this.rows<{ n: number; paisa: string; avg: string | null }>(sql`
        select count(*)::int as n, coalesce(sum(s.total_paisa), 0)::bigint as paisa,
          round(avg(s.total_paisa))::bigint as avg
        from sales s where ${salesIn}`),
        this.rows<{
          method: string;
          n: number;
          paisa: string;
          pending: string;
        }>(
          sql`
        select p.method::text as method, count(*)::int as n,
          sum(p.amount_paisa)::bigint as paisa,
          coalesce(sum(p.amount_paisa) filter (where p.status = 'pending'), 0)::bigint
            as pending
        from payments p where ${collectedIn}
        group by p.method`,
        ),
        this.rows<{ n: number; paisa: string }>(sql`
        select count(*)::int as n, coalesce(sum(r.total_paisa), 0)::bigint as paisa
        from sale_returns r
        where r.business_id = ${b}
          and r.day_plan_id in ${plansOf(salesmanId)}
          and r.return_date between ${from} and ${to}`),
        this.rows<{ plans: number; units: string; paisa: string }>(sql`
        with pl as (
          select dp.id, dp.status from day_plans dp
          where dp.business_id = ${b} and dp.salesman_id = ${salesmanId}
            and dp.plan_date between ${from} and ${to}
            and dp.status in ('closed', 'reconciled')
        ), moves as (
          -- issued, less what came back: the manager's count once
          -- reconciled, else the salesman's return
          select l.day_plan_id, l.product_id,
            ${base(sql`l.quantity_issued`, sql`l.unit`)}
            - coalesce(case when pl.status = 'reconciled'
                then ${base(sql`l.quantity_counted`, sql`l.unit`)}
                else ${base(sql`l.quantity_returned`, sql`l.unit`)} end, 0) as q
          from day_plan_stock l
          join pl on pl.id = l.day_plan_id
          join products pr on pr.id = l.product_id
          union all
          select s.day_plan_id, si.product_id,
            -${base(sql`si.quantity`, sql`si.unit`)}
          from sale_items si
          join sales s on s.id = si.sale_id
          join pl on pl.id = s.day_plan_id
          join products pr on pr.id = si.product_id
          where s.status = 'confirmed'
          union all
          select w.day_plan_id, w.product_id,
            -${base(sql`w.quantity`, sql`w.unit`)}
          from stock_write_offs w
          join pl on pl.id = w.day_plan_id
          join products pr on pr.id = w.product_id
        ), per as (
          select m.day_plan_id, m.product_id, greatest(sum(m.q), 0) as missing
          from moves m group by m.day_plan_id, m.product_id
        )
        select (select count(*)::int from pl) as plans,
          coalesce(sum(per.missing), 0)::bigint as units,
          coalesce(sum(per.missing * pr.price_paisa), 0)::bigint as paisa
        from per join products pr on pr.id = per.product_id`),
        this.rows<{
          date: string;
          sales_count: number;
          sales_paisa: string;
          collected_paisa: string;
        }>(sql`
        with sold as (
          select s.sale_date as d, count(*)::int as n, sum(s.total_paisa) as paisa
          from sales s where ${salesIn} group by s.sale_date
        ), got as (
          select ${receivedOn} as d, sum(p.amount_paisa) as paisa
          from payments p where ${collectedIn} group by 1
        )
        select to_char(g.d, 'YYYY-MM-DD') as date,
          coalesce(sold.n, 0) as sales_count,
          coalesce(sold.paisa, 0)::bigint as sales_paisa,
          coalesce(got.paisa, 0)::bigint as collected_paisa
        from generate_series(${from}::date, ${to}::date, interval '1 day') g(d)
        left join sold on sold.d = g.d::date
        left join got on got.d = g.d::date
        order by g.d`),
        this.rows<{
          id: string;
          name: string;
          sales_count: number;
          sales_paisa: string;
          collected_paisa: string;
        }>(sql`
        with sold as (
          select s.client_id, count(*)::int as n, sum(s.total_paisa) as paisa
          from sales s where ${salesIn} group by s.client_id
        ), got as (
          select p.client_id, sum(p.amount_paisa) as paisa
          from payments p where ${collectedIn} group by p.client_id
        )
        select c.id, c.name,
          coalesce(sold.n, 0) as sales_count,
          coalesce(sold.paisa, 0)::bigint as sales_paisa,
          coalesce(got.paisa, 0)::bigint as collected_paisa
        from (select client_id from sold union select client_id from got) k
        join retail_clients c on c.id = k.client_id
        left join sold on sold.client_id = k.client_id
        left join got on got.client_id = k.client_id
        order by coalesce(sold.paisa, 0) desc, c.name, c.id`),
        this.rows<{
          id: string;
          name: string;
          sku: string | null;
          unit: string;
          quantity: string;
          sales_paisa: string;
        }>(sql`
        select pr.id, pr.name, pr.sku, pr.unit,
          sum(${base(sql`si.quantity`, sql`si.unit`)})::bigint as quantity,
          sum(si.line_total_paisa)::bigint as sales_paisa
        from sale_items si
        join sales s on s.id = si.sale_id
        join products pr on pr.id = si.product_id
        where ${salesIn}
        group by pr.id
        order by sales_paisa desc, pr.name, pr.id
        limit ${TOP_PRODUCTS}`),
      ]);

    return {
      salesman,
      from,
      to,
      sales: {
        count: totals.n,
        totalPaisa: num(totals.paisa),
        /** Rounded to the nearest paisa; 0 with no sales. */
        averagePaisa: num(totals.avg),
      },
      payments: {
        totalPaisa: methods.reduce((n, m) => n + num(m.paisa), 0),
        byMethod: PAYMENT_METHODS.map((method) => {
          const m = methods.find((r) => r.method === method);
          return {
            method,
            count: m?.n ?? 0,
            totalPaisa: num(m?.paisa ?? 0),
            /** Of the total: cheques and transfers not yet confirmed. */
            pendingPaisa: num(m?.pending ?? 0),
          };
        }),
      },
      returns: { count: returns.n, totalPaisa: num(returns.paisa) },
      shortage: {
        /** Closed or reconciled plans in the range that were counted. */
        plans: shortage.plans,
        /** Missing base units, summed across products. */
        units: num(shortage.units),
        valuePaisa: num(shortage.paisa),
      },
      days: days.map((d) => ({
        date: d.date,
        salesCount: d.sales_count,
        salesPaisa: num(d.sales_paisa),
        collectedPaisa: num(d.collected_paisa),
      })),
      shops: shops.map((s) => ({
        shop: { id: s.id, name: s.name },
        salesCount: s.sales_count,
        salesPaisa: num(s.sales_paisa),
        collectedPaisa: num(s.collected_paisa),
      })),
      topProducts: top.map((p) => ({
        product: { id: p.id, name: p.name, sku: p.sku, unit: p.unit },
        /** In the product's base unit. */
        quantity: num(p.quantity),
        salesPaisa: num(p.sales_paisa),
      })),
    };
  }

  // ---------- overdue credit ----------

  /**
   * Shops with part of a sale unpaid past its due date, the longest overdue
   * first. Uses the ledger's rule: money in (confirmed payments, returns,
   * any opening credit) settles the oldest debt first: the opening balance,
   * then sales by date and invoice number. A sale with no due date is never
   * overdue. Agrees with each shop's balance summary (tested).
   */
  async overdueCredit(actor: StaffTokenPayload, query: PaginationQueryDto) {
    const today = nepalToday();
    const b = actor.businessId;
    const overdue = sql`
      with s as (
        select s.client_id, s.due_date, s.total_paisa,
          sum(s.total_paisa) over (
            partition by s.client_id order by s.sale_date, s.invoice_number
          ) as upto
        from sales s
        join retail_clients c on c.id = s.client_id
        where c.business_id = ${b} and s.status = 'confirmed'
      ), paid as (
        select p.client_id, sum(p.amount_paisa) as paisa
        from payments p
        join retail_clients c on c.id = p.client_id
        where c.business_id = ${b} and p.status = 'confirmed'
        group by p.client_id
      ), returned as (
        select r.client_id, sum(r.total_paisa) as paisa
        from sale_returns r
        join retail_clients c on c.id = r.client_id
        where c.business_id = ${b}
        group by r.client_id
      ), pool as (
        -- What has been settled beyond the opening balance.
        select c.id as client_id, c.opening_balance_paisa as opening,
          coalesce(paid.paisa, 0) as paid, coalesce(returned.paisa, 0) as returned,
          greatest(0, coalesce(paid.paisa, 0) + coalesce(returned.paisa, 0)
            - c.opening_balance_paisa) as settled
        from retail_clients c
        left join paid on paid.client_id = c.id
        left join returned on returned.client_id = c.id
        where c.business_id = ${b}
      ), unpaid as (
        -- Each sale's unpaid part: what is not covered by the settled amount
        -- once every older sale has taken its share.
        select s.client_id, s.due_date,
          greatest(0, least(s.total_paisa, s.upto - pool.settled)) as paisa
        from s join pool on pool.client_id = s.client_id
      )
      select u.client_id, min(u.due_date) as oldest_due_date,
        count(*)::int as sales_count, sum(u.paisa)::bigint as overdue_paisa
      from unpaid u
      where u.due_date < ${today} and u.paisa > 0
      group by u.client_id`;

    const [page, [{ total }]] = await Promise.all([
      this.rows<{
        id: string;
        name: string;
        phone: string | null;
        oldest_due_date: string;
        days_overdue: number;
        sales_count: number;
        overdue_paisa: string;
        balance_paisa: string;
        credit_limit_paisa: string;
      }>(sql`
        with o as (${overdue})
        select c.id, c.name, c.phone,
          to_char(o.oldest_due_date, 'YYYY-MM-DD') as oldest_due_date,
          (${today}::date - o.oldest_due_date) as days_overdue,
          o.sales_count, o.overdue_paisa, c.credit_limit_paisa,
          (c.opening_balance_paisa
            + coalesce((select sum(s.total_paisa) from sales s
                where s.client_id = c.id and s.status = 'confirmed'), 0)
            - coalesce((select sum(p.amount_paisa) from payments p
                where p.client_id = c.id and p.status = 'confirmed'), 0)
            - coalesce((select sum(r.total_paisa) from sale_returns r
                where r.client_id = c.id), 0))::bigint as balance_paisa
        from o join retail_clients c on c.id = o.client_id
        order by o.oldest_due_date, c.name, c.id
        limit ${query.limit} offset ${getOffset(query)}`),
      this.rows<{ total: number }>(
        sql`select count(*)::int as total from (${overdue}) o`,
      ),
    ]);
    const data = page.map((r) => ({
      shop: { id: r.id, name: r.name, phone: r.phone },
      oldestDueDate: r.oldest_due_date,
      daysOverdue: r.days_overdue,
      overdueSales: r.sales_count,
      overduePaisa: num(r.overdue_paisa),
      balancePaisa: num(r.balance_paisa),
      creditLimitPaisa: num(r.credit_limit_paisa),
    }));
    return { asOf: today, ...buildPaginatedResult(data, total, query) };
  }

  // ---------- low stock ----------

  /**
   * Active products whose warehouse stock is at or below their alert level,
   * the emptiest first. Products with no alert level set never appear.
   */
  async lowStock(actor: StaffTokenPayload, query: PaginationQueryDto) {
    const where = and(
      eq(products.businessId, actor.businessId),
      eq(products.isActive, true),
      isNotNull(products.lowStockAlert),
      lte(products.stockQuantity, products.lowStockAlert),
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          unit: products.unit,
          unitsPerCarton: products.unitsPerCarton,
          stockQuantity: products.stockQuantity,
          lowStockAlert: products.lowStockAlert,
        })
        .from(products)
        .where(where)
        .orderBy(
          asc(sql`${products.stockQuantity} - ${products.lowStockAlert}`),
          asc(products.name),
          asc(products.id),
        )
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  // ---------- helpers ----------

  /** Salesmen may ask only about themselves; others about any staff member. */
  private async salesman(actor: StaffTokenPayload, id: string) {
    if (actor.role === 'salesman' && id !== actor.sub) throw fail.notOwn();
    const [user] = await this.db
      .select({ id: users.id, fullName: users.fullName, role: users.role })
      .from(users)
      .where(and(eq(users.id, id), eq(users.businessId, actor.businessId)));
    if (!user) throw fail.userNotFound();
    return user;
  }
}

function assertRange(q: { from: string; to: string }, maxDays?: number) {
  if (q.from > q.to) throw fail.badRange();
  if (maxDays) {
    const days =
      (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) /
        86_400_000 +
      1;
    if (days > maxDays) throw fail.rangeTooLong();
  }
}
