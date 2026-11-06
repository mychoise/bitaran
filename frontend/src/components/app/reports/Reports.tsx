"use client";

// Reports: a hub and five reports. Each keeps its dates (and salesman) in the address, exports
// CSV and prints cleanly (filters and buttons are left off the page).

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { BarChart } from "@/components/ui/BarChart";
import { Button } from "@/components/ui/Button";
import { DateRangePicker, presetRange, type Range } from "@/components/ui/Controls";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { BackLink } from "@/components/ui/Form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { LowStockItem, SalesmanHistoryEntry } from "@/lib/api/types";
import { addDays, daysBetween, formatDate, formatTime, todayNepal } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";
import { cartonEquivalent, countUnits } from "@/lib/units";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { DateFilter, okDate } from "../records/filters";
import { InvoiceItems } from "../records/InvoiceItems";

const csvAmount = (paisa: number) => formatAmount(paisa).replace(/,/g, "");
const METHOD = { cash: "Cash", cheque: "Cheque", online: "Online" } as const;
const BACK = <BackLink href="/app/manager/reports" label="Reports" />;

function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Print
    </Button>
  );
}

/** A date range read from the address, falling back to the last 30 days. */
function useRange(url: { from: string; to: string }): Range {
  const fallback = presetRange("month");
  return { from: okDate(url.from) || fallback.from, to: okDate(url.to) || fallback.to };
}

function RangeProblem({ range }: { range: Range }) {
  return range.from > range.to ? <p className="mb-4 text-error">The start date is after the end date.</p> : null;
}

function SalesmanPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const look = usePlanLookups();
  return (
    <div className="w-64">
      <Select label="Salesman" size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a salesman</option>
        {look.salesmen.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
            {s.active ? "" : " (inactive)"}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Figures({ items }: { items: [string, ReactNode, ReactNode?][] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([k, v, note]) => (
        <Card key={k} dense>
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="m-0 mt-1 font-outlier text-xl">{v}</dd>
          {note ? <dd className="m-0 text-sm text-ink-2">{note}</dd> : null}
        </Card>
      ))}
    </dl>
  );
}

const SectionTitle = ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => (
  <div className="mt-8 mb-3 flex flex-wrap items-end justify-between gap-3">
    <h2 className="text-title tracking-normal">{children}</h2>
    {actions ? <div className="no-print">{actions}</div> : null}
  </div>
);

// ---- hub -----------------------------------------------------------------------------------------

const REPORTS = [
  { href: "today", title: "Today", line: "Every shop's sales and cash, and each salesman's totals: today, or any dates." },
  { href: "salesman-history", title: "Salesman history", line: "Every sale and payment one salesman took in a date range, newest first." },
  { href: "salesman-analytics", title: "Salesman analytics", line: "Totals, average sale, payments by method, returns, shortage, day by day, shop by shop, and top products." },
  { href: "overdue", title: "Overdue credit", line: "Shops with an unpaid amount past its due date, oldest first." },
  { href: "low-stock", title: "Low stock", line: "Products at or below their low-stock level, with how much sold in the dates." },
];

export function ReportsHub() {
  return (
    <>
      <PageHeader title="Reports" lead="Each one keeps its dates in the address, exports to CSV and prints." />
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <li key={r.href}>
            <Card dense className="flex h-full flex-col gap-2">
              <h2 className="text-title tracking-normal">
                <Link href={`/app/manager/reports/${r.href}`} className="text-link">
                  {r.title}
                </Link>
              </h2>
              <p className="text-ink-2">{r.line}</p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- today ---------------------------------------------------------------------------------------

type DayRow = { id: string; count: number; totalPaisa: number; cashPaisa: number };

export function TodayReportView() {
  const look = usePlanLookups();
  const today = todayNepal();
  const [url, setUrl] = useUrlState(["from", "to"] as const);
  // Today unless the address says otherwise.
  const range: Range = { from: okDate(url.from) || today, to: okDate(url.to) || today };
  const ok = range.from <= range.to;
  const q = useApiQuery(["reports", "today", range], (api) => api.reports.today(range), { enabled: ok, placeholderData: (prev) => prev });
  const d = q.data;
  const isToday = range.from === today && range.to === today;
  const oneDay = range.from === range.to;
  const tag = oneDay ? range.from : `${range.from}-to-${range.to}`;

  const rowsColumns = (header: string, name: (id: string) => ReactNode, text: (id: string) => string): Column<DayRow>[] => [
    { key: "name", header, rowHeader: true, cell: (r) => name(r.id), sortValue: (r) => text(r.id) },
    { key: "count", header: "Sales", numeric: true, cell: (r) => r.count, sortValue: (r) => r.count },
    { key: "total", header: "Sold", numeric: true, cell: (r) => <MoneyText paisa={r.totalPaisa} />, sortValue: (r) => r.totalPaisa, csv: (r) => csvAmount(r.totalPaisa) },
    { key: "cash", header: "Cash collected", numeric: true, cell: (r) => <MoneyText paisa={r.cashPaisa} />, sortValue: (r) => r.cashPaisa, csv: (r) => csvAmount(r.cashPaisa) },
  ];
  const salesmanColumns = rowsColumns("Salesman", look.person, look.person);
  const shopName = (id: string) => look.shop(id)?.name ?? "…";
  const shopColumns = rowsColumns("Shop", (id) => <Link href={`/app/manager/shops/${id}`} className="text-link">{shopName(id)}</Link>, shopName);
  const bySalesman = d?.bySalesman.map(({ salesmanId, ...r }) => ({ id: salesmanId, ...r }));
  const byShop = d?.byShop.map(({ shopId, ...r }) => ({ id: shopId, ...r }));
  const totals = d ? { label: "Total", cells: { count: d.count, total: <MoneyText paisa={d.totalPaisa} />, cash: <MoneyText paisa={d.cashCollectedPaisa} /> } } : undefined;

  return (
    <>
      {BACK}
      <PageHeader title={isToday ? "Today" : "Sales and cash"} lead={oneDay ? formatDate(range.from) : `${formatDate(range.from)} to ${formatDate(range.to)}`} actions={<PrintButton />} />
      <div className="no-print mb-6">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from === today && r.to === today ? "" : r.from, to: r.from === today && r.to === today ? "" : r.to })} />
      </div>
      <RangeProblem range={range} />
      {!ok ? null : q.isPending ? (
        <LoadingState label="Loading the sales" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <Figures
            items={[
              ["Sold", formatMoney(d!.totalPaisa)],
              ["Invoices", d!.count],
              ["Cash collected", formatMoney(d!.cashCollectedPaisa)],
              ["Shops with activity", d!.byShop.length],
            ]}
          />
          <SectionTitle actions={<ExportButton filename={`sales-${tag}-by-salesman.csv`} columns={salesmanColumns} rows={bySalesman} />}>Per salesman</SectionTitle>
          <Table caption="Per salesman" columns={salesmanColumns} rows={bySalesman} rowKey={(r) => r.id} totals={totals} empty={{ title: oneDay ? "No sales or cash this day" : "No sales or cash in these dates", line: "Pick other dates." }} />
          <SectionTitle actions={<ExportButton filename={`sales-${tag}-by-shop.csv`} columns={shopColumns} rows={byShop} />}>All shops</SectionTitle>
          <Table caption="All shops" columns={shopColumns} rows={byShop} rowKey={(r) => r.id} totals={totals} empty={{ title: oneDay ? "No sales or cash this day" : "No sales or cash in these dates", line: "Pick other dates." }} />
        </>
      )}
    </>
  );
}

// ---- salesman history ----------------------------------------------------------------------------

export function SalesmanHistoryReport() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["salesman", "from", "to", "sort"] as const);
  const range = useRange(url);
  const ok = Boolean(url.salesman) && range.from <= range.to;
  const q = useApiQuery(["reports", "salesmanHistory", url.salesman, range], (api) => api.reports.salesmanHistory(url.salesman, range), { enabled: ok, placeholderData: (prev) => prev });
  const shopName = (id: string) => look.shop(id)?.name ?? "…";
  const sales = (q.data ?? []).filter((e) => e.kind === "sale" && e.status === "confirmed");
  const payments = (q.data ?? []).filter((e) => e.kind === "payment" && e.status !== "bounced");

  const columns: Column<SalesmanHistoryEntry>[] = [
    { key: "date", header: "When", cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}, {formatTime(e.at)}</span>, sortValue: (e) => e.at, csv: (e) => `${e.date} ${formatTime(e.at)}` },
    { key: "kind", header: "What", rowHeader: true, cell: (e) => <Link href={`/app/manager/${e.kind === "sale" ? "sales" : "payments"}/${e.id}`} className="text-link">{e.kind === "sale" ? e.ref : `${e.ref} payment`}</Link>, sortValue: (e) => e.kind, csv: (e) => (e.kind === "sale" ? e.ref : `${e.ref} payment`) },
    { key: "shop", header: "Shop", cell: (e) => shopName(e.shopId), sortValue: (e) => shopName(e.shopId) },
    { key: "items", header: "Items", cell: (e) => (e.kind === "sale" ? <InvoiceItems saleId={e.id} /> : null) },
    { key: "amount", header: "Amount", numeric: true, cell: (e) => <MoneyText paisa={e.amountPaisa} />, sortValue: (e) => e.amountPaisa, csv: (e) => csvAmount(e.amountPaisa) },
    { key: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} />, sortValue: (e) => e.status },
  ];
  const name = url.salesman ? look.person(url.salesman) : "";

  return (
    <>
      {BACK}
      <PageHeader
        title="Salesman history"
        lead={url.salesman ? `${name}, ${formatDate(range.from)} to ${formatDate(range.to)}` : "Every sale and payment one salesman took, newest first."}
        actions={
          <>
            <ExportButton filename={`history-${name.replace(/\s+/g, "-").toLowerCase()}-${range.from}-${range.to}.csv`} columns={columns} rows={q.data} />
            <PrintButton />
          </>
        }
      />
      <div className="no-print mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <SalesmanPick value={url.salesman} onChange={(v) => setUrl({ salesman: v })} />
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      <RangeProblem range={range} />
      {!url.salesman ? (
        <EmptyState title="Choose a salesman" line="Their sales and payments in these dates show up here." />
      ) : (
        <>
          {q.data ? (
            <p className="mb-3 text-ink-2">
              {sales.length} sale{sales.length === 1 ? "" : "s"}, <MoneyText paisa={sales.reduce((a, e) => a + e.amountPaisa, 0)} />. {payments.length} payment{payments.length === 1 ? "" : "s"} (bounced left out), <MoneyText paisa={payments.reduce((a, e) => a + e.amountPaisa, 0)} />.
            </p>
          ) : null}
          <Table
            caption={`Sales and payments by ${name}`}
            columns={columns}
            rows={ok ? q.data : []}
            rowKey={(e) => `${e.kind}-${e.id}`}
            loading={ok && q.isPending}
            error={q.isError ? errorMessage(q.error) : null}
            onRetry={() => q.refetch()}
            sort={parseSort(url.sort)}
            onSortChange={(s) => setUrl({ sort: formatSort(s) })}
            empty={{ title: "Nothing in these dates", line: "Try a wider date range." }}
          />
        </>
      )}
    </>
  );
}

// ---- salesman analytics --------------------------------------------------------------------------

type DayBar = { date: string; count: number; totalPaisa: number };

export function SalesmanAnalyticsReport() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["salesman", "from", "to"] as const);
  const range = useRange(url);
  const ok = Boolean(url.salesman) && range.from <= range.to;
  const q = useApiQuery(["reports", "salesman", url.salesman, range], (api) => api.reports.salesmanAnalytics(url.salesman, range), { enabled: ok, placeholderData: (prev) => prev });
  const d = q.data;
  const name = url.salesman ? look.person(url.salesman) : "";

  // Every day in the range, so quiet days show as gaps.
  const days = useMemo<DayBar[]>(() => {
    if (!d) return [];
    const by = new Map(d.perDay.map((x) => [x.date, x]));
    const n = Math.min(92, daysBetween(range.from, range.to) + 1);
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(range.from, i);
      return { date, count: by.get(date)?.count ?? 0, totalPaisa: by.get(date)?.totalPaisa ?? 0 };
    });
  }, [d, range.from, range.to]);
  const dayColumns: Column<DayBar>[] = [
    { key: "date", header: "Date", rowHeader: true, cell: (x) => formatDate(x.date), sortValue: (x) => x.date, csv: (x) => x.date },
    { key: "count", header: "Sales", numeric: true, cell: (x) => x.count, sortValue: (x) => x.count },
    { key: "total", header: "Sold", numeric: true, cell: (x) => <MoneyText paisa={x.totalPaisa} />, sortValue: (x) => x.totalPaisa, csv: (x) => csvAmount(x.totalPaisa) },
  ];
  type ShopRow = { shopId: string; count: number; totalPaisa: number };
  const shopName = (id: string) => look.shop(id)?.name ?? "…";
  const shopColumns: Column<ShopRow>[] = [
    { key: "shop", header: "Shop", rowHeader: true, cell: (x) => shopName(x.shopId), sortValue: (x) => shopName(x.shopId) },
    { key: "count", header: "Sales", numeric: true, cell: (x) => x.count, sortValue: (x) => x.count },
    { key: "total", header: "Sold", numeric: true, cell: (x) => <MoneyText paisa={x.totalPaisa} />, sortValue: (x) => x.totalPaisa, csv: (x) => csvAmount(x.totalPaisa) },
  ];
  const collected = d ? d.payments.reduce((a, p) => a + p.amountPaisa, 0) : 0;
  const pending = d ? d.payments.reduce((a, p) => a + p.pendingCount, 0) : 0;
  const unit = (id: string) => look.product(id)?.unitName ?? "unit";

  return (
    <>
      {BACK}
      <PageHeader
        title="Salesman analytics"
        lead={url.salesman ? `${name}, ${formatDate(range.from)} to ${formatDate(range.to)}` : "One salesman's numbers over a date range."}
        actions={
          <>
            <ExportButton filename={`analytics-per-day-${range.from}-${range.to}.csv`} columns={dayColumns} rows={d ? days : undefined} />
            <PrintButton />
          </>
        }
      />
      <div className="no-print mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <SalesmanPick value={url.salesman} onChange={(v) => setUrl({ salesman: v })} />
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      <RangeProblem range={range} />
      {!url.salesman ? (
        <EmptyState title="Choose a salesman" line="Their numbers for these dates show up here." />
      ) : !ok ? null : q.isPending ? (
        <LoadingState label="Working out the numbers" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <Figures
            items={[
              ["Sold", formatMoney(d!.sales.totalPaisa), `${d!.sales.count} invoice${d!.sales.count === 1 ? "" : "s"}`],
              ["Average sale", d!.sales.count ? formatMoney(Math.round(d!.sales.totalPaisa / d!.sales.count)) : "No sales"],
              ["Collected", formatMoney(collected), pending ? `${pending} still pending` : "None pending"],
              ["Returns credited", formatMoney(d!.returnsPaisa)],
              ["Shortage", formatMoney(d!.shortage.valuePaisa), `${d!.shortage.units} unit${d!.shortage.units === 1 ? "" : "s"} over ${d!.shortage.plans} reconciled day${d!.shortage.plans === 1 ? "" : "s"}`],
              ["Expenses", formatMoney(d!.expensesPaisa), "Salary, fuel, khaja and other"],
            ]}
          />
          <Card as="section" dense className="mt-6" aria-label="Sales per day">
            <BarChart title="Sales per day" valueLabel="Sold" bars={days.map((x) => ({ key: x.date, label: formatDate(x.date).replace(/ \d{4}$/, ""), value: x.totalPaisa, display: x.count ? `${formatMoney(x.totalPaisa)}, ${x.count} sale${x.count === 1 ? "" : "s"}` : "No sales" }))} />
          </Card>

          <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
            <section aria-labelledby="pm-title">
              <SectionTitle>
                <span id="pm-title">Payments by method</span>
              </SectionTitle>
              {d!.payments.length === 0 ? (
                <p className="text-ink-2">No payments in these dates.</p>
              ) : (
                <Table
                  caption="Payments by method"
                  columns={[
                    { key: "m", header: "Method", rowHeader: true, cell: (p) => METHOD[p.method] },
                    { key: "c", header: "Payments", numeric: true, cell: (p) => <>{p.count}{p.pendingCount ? <span className="text-sm text-muted"> ({p.pendingCount} pending)</span> : null}</> },
                    { key: "a", header: "Amount", numeric: true, cell: (p) => <MoneyText paisa={p.amountPaisa} /> },
                  ]}
                  rows={d!.payments}
                  rowKey={(p) => p.method}
                  totals={{ label: "Total", cells: { a: <MoneyText paisa={collected} /> } }}
                />
              )}
              <p className="mt-2 text-sm text-muted">Bounced payments are left out.</p>
            </section>
            <section aria-labelledby="tp-title">
              <SectionTitle>
                <span id="tp-title">Top products</span>
              </SectionTitle>
              {d!.topProducts.length === 0 ? (
                <p className="text-ink-2">No sales in these dates.</p>
              ) : (
                <Table
                  caption="Top products"
                  columns={[
                    { key: "p", header: "Product", rowHeader: true, cell: (t) => look.product(t.productId)?.name ?? "…" },
                    { key: "u", header: "Sold", numeric: true, cell: (t) => countUnits(t.baseUnits, unit(t.productId)) },
                    { key: "v", header: "Value", numeric: true, cell: (t) => <MoneyText paisa={t.totalPaisa} /> },
                  ]}
                  rows={d!.topProducts}
                  rowKey={(t) => t.productId}
                />
              )}
            </section>
          </div>

          <SectionTitle actions={<ExportButton filename={`analytics-per-shop-${range.from}-${range.to}.csv`} columns={shopColumns} rows={d!.perShop} />}>Shop by shop</SectionTitle>
          <Table caption="Sales shop by shop" columns={shopColumns} rows={d!.perShop} rowKey={(x) => x.shopId} totals={{ label: "Total", cells: { count: d!.sales.count, total: <MoneyText paisa={d!.sales.totalPaisa} /> } }} empty={{ title: "No sales in these dates", line: "Try a wider date range." }} />

          <SectionTitle>Shortage by product</SectionTitle>
          {d!.shortage.byProduct.length === 0 ? (
            <p className="text-ink-2">{d!.shortage.plans ? "Every unit was accounted for on the reconciled days." : "No day in these dates has been reconciled yet."}</p>
          ) : (
            <Table
              caption="Shortage by product"
              columns={[
                { key: "p", header: "Product", rowHeader: true, cell: (x) => look.product(x.productId)?.name ?? "…" },
                { key: "u", header: "Short", numeric: true, cell: (x) => countUnits(x.units, unit(x.productId)) },
                { key: "v", header: "At unit price", numeric: true, cell: (x) => <MoneyText paisa={x.valuePaisa} /> },
              ]}
              rows={d!.shortage.byProduct}
              rowKey={(x) => x.productId}
              totals={{ label: "Total", cells: { v: <MoneyText paisa={d!.shortage.valuePaisa} /> } }}
            />
          )}

          <SectionTitle actions={<ExportButton filename={`analytics-per-day-${range.from}-${range.to}.csv`} columns={dayColumns} rows={days} />}>Day by day</SectionTitle>
          <Table caption="Sales day by day" columns={dayColumns} rows={days} rowKey={(x) => x.date} totals={{ label: "Total", cells: { count: d!.sales.count, total: <MoneyText paisa={d!.sales.totalPaisa} /> } }} />
        </>
      )}
    </>
  );
}

// ---- overdue credit ------------------------------------------------------------------------------

type OverdueRow = { shopId: string; overduePaisa: number; oldestDueDate: string; days: number };

export function OverdueReport() {
  const look = usePlanLookups();
  const today = todayNepal();
  const [url, setUrl] = useUrlState(["from", "to", "sort"] as const);
  const q = useApiQuery(["reports", "overdue"], (api) => api.reports.overdue());
  const from = okDate(url.from);
  const to = okDate(url.to);
  // The dates narrow by the oldest unpaid due date.
  const rows = q.data
    ?.filter((o) => (!from || o.oldestDueDate >= from) && (!to || o.oldestDueDate <= to))
    .map((o): OverdueRow => ({ ...o, days: daysBetween(o.oldestDueDate, today) }));
  const shopName = (id: string) => look.shop(id)?.name ?? "…";
  const columns: Column<OverdueRow>[] = [
    { key: "shop", header: "Shop", rowHeader: true, cell: (o) => <Link href={`/app/manager/shops/${o.shopId}?tab=statement`} className="text-link">{shopName(o.shopId)}</Link>, sortValue: (o) => shopName(o.shopId) },
    { key: "phone", header: "Phone", cell: (o) => look.shop(o.shopId)?.phone ?? "", csv: (o) => look.shop(o.shopId)?.phone ?? "" },
    { key: "due", header: "Oldest due date", cell: (o) => <span className="whitespace-nowrap">{formatDate(o.oldestDueDate)}</span>, sortValue: (o) => o.oldestDueDate, csv: (o) => o.oldestDueDate },
    { key: "days", header: "Days overdue", numeric: true, cell: (o) => o.days, sortValue: (o) => o.days },
    { key: "amount", header: "Overdue", numeric: true, cell: (o) => <MoneyText paisa={o.overduePaisa} />, sortValue: (o) => o.overduePaisa, csv: (o) => csvAmount(o.overduePaisa) },
  ];
  const total = (rows ?? []).reduce((a, o) => a + o.overduePaisa, 0);

  return (
    <>
      {BACK}
      <PageHeader
        title="Overdue credit"
        lead={`As of ${formatDate(today)}. Payments are put against the oldest invoices first.`}
        actions={
          <>
            <ExportButton filename={`overdue-credit-${today}.csv`} columns={columns} rows={rows} />
            <PrintButton />
          </>
        }
      />
      <div className="no-print mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={from} to={to} onChange={setUrl} />
        <p className="self-center pb-7 text-sm text-muted lg:max-w-xs">Optional: narrows by the oldest unpaid due date.</p>
      </div>
      <Table
        caption="Overdue credit"
        columns={columns}
        rows={rows}
        rowKey={(o) => o.shopId}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        totals={{ label: `Total, ${rows?.length ?? 0} shop${rows?.length === 1 ? "" : "s"}`, cells: { amount: <MoneyText paisa={total} /> } }}
        empty={from || to ? { title: "No overdue shop in these dates", line: "Clear the dates to see every shop." } : { title: "Nothing overdue", line: "Every shop is within its credit days." }}
      />
    </>
  );
}

// ---- low stock -----------------------------------------------------------------------------------

export function LowStockReport() {
  const today = todayNepal();
  const [url, setUrl] = useUrlState(["from", "to", "sort"] as const);
  const range = useRange(url);
  const ok = range.from <= range.to;
  const q = useApiQuery(["reports", "lowStock", range], (api) => api.reports.lowStock(range), { enabled: ok, placeholderData: (prev) => prev });
  const columns: Column<LowStockItem>[] = [
    { key: "name", header: "Product", rowHeader: true, cell: (p) => <Link href={`/app/manager/products/${p.id}`} className="text-link">{p.name}</Link>, sortValue: (p) => p.name },
    { key: "sku", header: "SKU", cell: (p) => p.sku ?? "", sortValue: (p) => p.sku ?? "" },
    { key: "stock", header: "In the warehouse", numeric: true, cell: (p) => <>{countUnits(p.stockUnits, p.unitName)}{cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName) ? <span className="block text-sm text-muted">{cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName)}</span> : null}</>, sortValue: (p) => p.stockUnits },
    { key: "level", header: "Low-stock level", numeric: true, cell: (p) => countUnits(p.lowStockUnits, p.unitName), sortValue: (p) => p.lowStockUnits },
    { key: "sold", header: "Sold in these dates", numeric: true, cell: (p) => (p.soldUnits === undefined ? <span className="text-muted">Not available</span> : countUnits(p.soldUnits, p.unitName)), sortValue: (p) => p.soldUnits ?? -1, csv: (p) => p.soldUnits ?? "" },
  ];
  return (
    <>
      {BACK}
      <PageHeader
        title="Low stock"
        lead={`Warehouse stock now (${formatDate(today)}), with what sold from ${formatDate(range.from)} to ${formatDate(range.to)}. Stock out on a day plan is not counted.`}
        actions={
          <>
            <ExportButton filename={`low-stock-${today}.csv`} columns={columns} rows={q.data} />
            <PrintButton />
          </>
        }
      />
      <div className="no-print mb-4">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      <RangeProblem range={range} />
      <Table
        caption="Low stock"
        columns={columns}
        rows={ok ? q.data : []}
        rowKey={(p) => p.id}
        loading={ok && q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={{ title: "Nothing is low", line: "Every active product is above its low-stock level." }}
      />
    </>
  );
}
