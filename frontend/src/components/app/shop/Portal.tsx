"use client";

// The shop's own pages: what it owes, its statement, invoices, payments and returns, and its
// profile. Everything is read-only and comes from the shop-only calls, so a shop only ever sees
// its own records, and never a cost price. The tone is calm: numbers, not warnings.

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { buttonClass, Button } from "@/components/ui/Button";
import { DateRangePicker, Segmented, type Range } from "@/components/ui/Controls";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { BackLink } from "@/components/ui/Form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { PaymentStatus, ShopInvoice, ShopPayment, ShopReturn, StatementEntry } from "@/lib/api/types";
import { addDays, formatDate, formatDateTime, todayNepal } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { okDate } from "../records/filters";
import { InvoiceItems } from "../records/InvoiceItems";

const plain = (paisa: number) => formatAmount(paisa).replace(/,/g, "");
const METHOD = { cash: "Cash", cheque: "Cheque", online: "Online" } as const;
const KIND: Record<StatementEntry["kind"], string> = { opening: "Opening balance", sale: "Invoice", payment: "Payment", return: "Return" };
/** "Invoice 38", "Cash payment", "Return": the ref already names the kind, so say it once. */
const describe = (e: StatementEntry) => (e.kind === "opening" ? KIND.opening : /^(invoice|return)|payment/i.test(e.ref) ? e.ref : `${KIND[e.kind]} ${e.ref}`);
const REASON = { damaged: "damaged", expired: "expired", other: "other reason" } as const;
const quantity = (l: { unit: "unit" | "carton"; quantity: number; unitName: string }) => (l.unit === "carton" ? `${l.quantity} carton${l.quantity === 1 ? "" : "s"}` : countUnits(l.quantity, l.unitName));

/** A date range from the address, falling back to the last 90 days. */
function useRange(url: { from: string; to: string }): Range {
  const today = todayNepal();
  return { from: okDate(url.from) || addDays(today, -89), to: okDate(url.to) || today };
}

function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

/** Shown only on paper: whose statement or list this is, and when it was printed. */
function PrintNote({ children }: { children: ReactNode }) {
  return <p className="mb-3 hidden text-sm print:block">{children}</p>;
}

function useBusinessName() {
  const q = useApiQuery(["shopPortal", "me"], (api) => api.shopPortal.me());
  return q.data;
}

// ---- home ----------------------------------------------------------------------------------------

export function ShopHome() {
  const q = useApiQuery(["shopPortal", "summary"], (api) => api.shopPortal.summary());
  if (q.isPending) return <LoadingState label="Loading your balance" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const s = q.data;
  const owes = s.balancePaisa > 0;
  return (
    <>
      <PageHeader title={s.shopName} lead={`Your account with ${s.businessName}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card as="section" dense aria-label="Balance" className="flex flex-col gap-1">
          <h2 className="text-sm text-muted">{s.balancePaisa < 0 ? "Your credit" : "You owe"}</h2>
          <p className="font-outlier text-2xl leading-tight whitespace-nowrap">
            <MoneyText paisa={Math.abs(s.balancePaisa)} />
          </p>
          <p className="text-sm text-ink-2">{s.balancePaisa < 0 ? "Taken off your next invoice." : owes ? "Confirmed invoices less confirmed payments and returns." : "Nothing owed."}</p>
          <Link href="/app/shop/statement" className="text-link mt-auto pt-2 text-sm">
            See your statement
          </Link>
        </Card>
        <Card as="section" dense aria-label="Overdue" className="flex flex-col gap-1">
          <h2 className="text-sm text-muted">Overdue</h2>
          <p className="font-outlier text-2xl leading-tight whitespace-nowrap">{formatMoney(s.overduePaisa)}</p>
          <p className="text-sm text-ink-2">{s.oldestOverdueDate ? `The oldest unpaid part was due ${formatDate(s.oldestOverdueDate)}.` : "Nothing is past its due date."}</p>
          <Link href="/app/shop/invoices" className="text-link mt-auto pt-2 text-sm">
            See your invoices
          </Link>
        </Card>
        <Card as="section" dense aria-label="Last payment" className="flex flex-col gap-1">
          <h2 className="text-sm text-muted">Last payment</h2>
          {s.lastPayment ? (
            <>
              <p className="font-outlier text-2xl leading-tight whitespace-nowrap">{formatMoney(s.lastPayment.amountPaisa)}</p>
              <p className="text-sm text-ink-2">
                {METHOD[s.lastPayment.method]}, {formatDate(s.lastPayment.date)}
              </p>
              <p>
                <StatusBadge status={s.lastPayment.status} />
              </p>
            </>
          ) : (
            <p className="text-ink-2">No payments yet.</p>
          )}
          <Link href="/app/shop/payments" className="text-link mt-auto pt-2 text-sm">
            See your payments
          </Link>
        </Card>
      </div>
      {s.inClearingPaisa > 0 ? (
        <p className="mt-4 text-ink-2">
          {formatMoney(s.inClearingPaisa)} in cheques or online payments is still clearing. It lowers what you owe once {s.businessName} confirms it.
        </p>
      ) : null}
      <RecentActivity />
    </>
  );
}

function RecentActivity() {
  const q = useApiQuery(["shopPortal", "statement", "all"], (api) => api.shopPortal.statement());
  const recent = (q.data ?? []).slice(-6).reverse();
  return (
    <Card as="section" dense className="mt-6" aria-labelledby="recent-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="recent-title" className="text-title tracking-normal">
          Recent activity
        </h2>
        <Link href="/app/shop/statement" className="text-link">
          See your statement
        </Link>
      </div>
      {q.isPending ? (
        <LoadingState label="Loading activity" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : recent.length === 0 ? (
        <EmptyState title="Nothing yet" line="Invoices, payments and returns show up here." />
      ) : (
        <ul className="m-0 mt-4 list-none p-0">
          {recent.map((e, i) => (
            <li key={`${e.date}-${e.ref}-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-rule-2 py-3 md:grid-cols-4 md:items-baseline">
              <span className="text-sm text-muted">{formatDate(e.date)}</span>
              <span className="text-right md:text-left">{describe(e)}</span>
              <span className="md:text-right">{e.debitPaisa > 0 ? <MoneyText paisa={e.debitPaisa} /> : <>− <MoneyText paisa={e.creditPaisa} /></>}</span>
              <span className="text-right text-sm text-ink-2">
                Balance <MoneyText paisa={e.balancePaisa} balance />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---- statement -----------------------------------------------------------------------------------

export function ShopStatement() {
  const me = useBusinessName();
  const [url, setUrl] = useUrlState(["from", "to"] as const);
  const range = useRange(url);
  const ok = range.from <= range.to;
  const q = useApiQuery(["shopPortal", "statement", range], (api) => api.shopPortal.statement(range), { enabled: ok, placeholderData: (prev) => prev });
  const columns: Column<StatementEntry>[] = [
    { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}</span>, csv: (e) => e.date },
    { key: "what", header: "Details", rowHeader: true, cell: describe, csv: describe },
    { key: "debit", header: "Adds", numeric: true, cell: (e) => (e.debitPaisa ? <MoneyText paisa={e.debitPaisa} /> : null), csv: (e) => (e.debitPaisa ? plain(e.debitPaisa) : "") },
    { key: "credit", header: "Lowers", numeric: true, cell: (e) => (e.creditPaisa ? <MoneyText paisa={e.creditPaisa} /> : null), csv: (e) => (e.creditPaisa ? plain(e.creditPaisa) : "") },
    { key: "balance", header: "Balance", numeric: true, cell: (e) => <MoneyText paisa={e.balancePaisa} balance />, csv: (e) => plain(e.balancePaisa) },
  ];
  const last = q.data?.at(-1);
  return (
    <>
      <PageHeader
        title="Statement"
        lead={`${formatDate(range.from)} to ${formatDate(range.to)}`}
        actions={
          <>
            <ExportButton filename={`statement-${range.from}-${range.to}.csv`} columns={columns} rows={q.data} />
            <PrintButton label="Print statement" />
          </>
        }
      />
      <div className="no-print mb-4">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      {!ok ? <p className="mb-4 text-ink-2">The start date is after the end date.</p> : null}
      <PrintNote>
        Statement for {me?.shopName ?? "your shop"} from {me?.business.name ?? "your supplier"}, {formatDate(range.from)} to {formatDate(range.to)}. Printed {formatDateTime(new Date())}.
      </PrintNote>
      <Table
        caption="Your statement"
        columns={columns}
        rows={ok ? q.data : []}
        rowKey={(e) => `${e.date}-${e.kind}-${e.ref}-${e.balancePaisa}`}
        loading={ok && q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        totals={last ? { label: `Balance on ${formatDate(range.to)}`, cells: { balance: <MoneyText paisa={last.balancePaisa} balance /> } } : undefined}
        empty={{ title: "Nothing in these dates", line: "Try a wider date range." }}
      />
      <p className="mt-3 text-sm text-muted">
        The first line carries the balance from before these dates. Only confirmed payments lower the balance; a cheque or online payment counts once it clears.
      </p>
    </>
  );
}

// ---- invoices ------------------------------------------------------------------------------------

export function ShopInvoiceList() {
  const [url, setUrl] = useUrlState(["from", "to", "sort"] as const);
  const range = useRange(url);
  const ok = range.from <= range.to;
  const filter = useMemo(() => ({ from: range.from, to: range.to, pageSize: 200 }), [range.from, range.to]);
  const q = useApiQuery(["shopPortal", "invoices", filter], (api) => api.shopPortal.invoices(filter), { enabled: ok, placeholderData: (prev) => prev });
  const today = todayNepal();
  const columns: Column<ShopInvoice>[] = [
    { key: "no", header: "Invoice", rowHeader: true, cell: (s) => <Link href={`/app/shop/invoices/${s.id}`} className="text-link font-outlier">No. {s.invoiceNo}</Link>, sortValue: (s) => s.invoiceNo },
    { key: "date", header: "Date", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.date)}</span>, sortValue: (s) => s.date, csv: (s) => s.date },
    { key: "items", header: "Items", cell: (s) => <InvoiceItems saleId={s.id} source="shop" /> },
    { key: "total", header: "Total", numeric: true, cell: (s) => <MoneyText paisa={s.totalPaisa} />, sortValue: (s) => s.totalPaisa, csv: (s) => plain(s.totalPaisa) },
    { key: "paid", header: "Paid on it", numeric: true, cell: (s) => <MoneyText paisa={s.paidPaisa} />, sortValue: (s) => s.paidPaisa, csv: (s) => plain(s.paidPaisa) },
    {
      key: "due",
      header: "Due",
      cell: (s) => <span className="whitespace-nowrap">{s.dueDate ? formatDate(s.dueDate) : "None"}{s.status === "confirmed" && s.dueDate && s.dueDate < today && s.paidPaisa < s.totalPaisa ? <span className="block text-sm text-muted">past due</span> : null}</span>,
      sortValue: (s) => s.dueDate ?? "",
      csv: (s) => s.dueDate ?? "",
    },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];
  return (
    <>
      <PageHeader title="Invoices" lead={`${formatDate(range.from)} to ${formatDate(range.to)}`} actions={<><ExportButton filename={`invoices-${range.from}-${range.to}.csv`} columns={columns} rows={q.data?.items} /><PrintButton /></>} />
      <div className="no-print mb-4">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      <Table
        caption="Your invoices"
        columns={columns}
        rows={ok ? q.data?.items : []}
        rowKey={(s) => s.id}
        loading={ok && q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={{ title: "No invoices in these dates", line: "Try a wider date range." }}
      />
      <p className="mt-3 text-sm text-muted">&quot;Paid on it&quot; counts confirmed payments made against that invoice. Payments towards your balance show on your statement.</p>
    </>
  );
}

export function ShopInvoiceDetail({ id }: { id: string }) {
  const me = useBusinessName();
  const q = useApiQuery(["shopPortal", "invoice", id], (api) => api.shopPortal.invoice(id));
  if (q.isPending) return <LoadingState label="Loading the invoice" />;
  if (q.isError) {
    if (q.error instanceof ApiError && (q.error.code === "not_found" || q.error.code === "forbidden"))
      return <EmptyState title="This invoice was not found" line="It may belong to another shop, or the link is wrong." action={<Link href="/app/shop/invoices" className={buttonClass("secondary", "sm")}>Back to invoices</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const s = q.data;
  const owed = s.totalPaisa - s.paidPaisa;
  return (
    <>
      <BackLink href="/app/shop/invoices" label="Invoices" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="article" className="lg:col-span-2" aria-labelledby="invoice-title">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <p className="font-semibold">{me?.business.name}</p>
              <p className="text-sm text-ink-2">{me ? `${me.business.address}, ${me.business.city}` : ""}</p>
              <p className="text-sm text-ink-2">{me ? `PAN ${me.business.pan}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">Invoice</p>
              <h1 id="invoice-title" className="mt-1 font-outlier text-display-s leading-none">
                No. {s.invoiceNo}
              </h1>
              <p className="mt-2">
                <StatusBadge status={s.status} />
              </p>
            </div>
          </div>
          <dl className="m-0 mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">To</dt>
              <dd className="m-0 mt-0.5">
                <span className="font-medium">{me?.shopName}</span>
                <span className="block text-ink-2">{me?.address}</span>
                {me?.pan ? <span className="block text-ink-2">PAN {me.pan}</span> : null}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-muted">Date</dt>
              <dd className="m-0 mt-0.5">{formatDateTime(s.createdAt)}</dd>
              <dt className="mt-2 text-muted">Due</dt>
              <dd className="m-0 mt-0.5">{s.dueDate ? formatDate(s.dueDate) : "None"}</dd>
            </div>
          </dl>
          <div className="table-scroll mt-5">
            <table className="data-table">
              <caption className="visually-hidden">Items on invoice {s.invoiceNo}</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="num">Quantity</th>
                  <th scope="col" className="num">Price</th>
                  <th scope="col" className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.lines.map((l, i) => (
                  <tr key={i}>
                    <th scope="row" className="font-normal">{l.productName}</th>
                    <td className="num">{quantity(l)}</td>
                    <td className="num"><MoneyText paisa={l.pricePaisa} /></td>
                    <td className="num"><MoneyText paisa={l.totalPaisa} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="m-0 mt-3 ml-auto flex max-w-xs flex-col gap-1">
            {s.discountPaisa ? (
              <>
                <div className="flex justify-between"><dt>Items</dt><dd className="m-0"><MoneyText paisa={s.subtotalPaisa ?? s.totalPaisa + s.discountPaisa} /></dd></div>
                <div className="flex justify-between"><dt>Discount</dt><dd className="m-0"><MoneyText paisa={-s.discountPaisa} /></dd></div>
              </>
            ) : null}
            <div className="flex justify-between border-t-2 border-ink pt-1 text-lg font-semibold"><dt>Total</dt><dd className="m-0"><MoneyText paisa={s.totalPaisa} /></dd></div>
            <div className="flex justify-between"><dt>Paid on it</dt><dd className="m-0"><MoneyText paisa={s.paidPaisa} /></dd></div>
            {s.status === "confirmed" && owed > 0 ? <div className="flex justify-between"><dt>Still to pay</dt><dd className="m-0"><MoneyText paisa={owed} /></dd></div> : null}
          </dl>
          {s.status === "cancelled" ? (
            <p className="mt-4 rounded-input border border-rule-2 bg-paper-3 p-3 text-sm">
              This invoice was cancelled{s.cancelledAt ? ` on ${formatDate(s.cancelledAt.slice(0, 10))}` : ""} and does not count towards what you owe.{s.cancelReason ? ` Reason: ${s.cancelReason}` : ""}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-muted">Sold by {s.salesmanName}.</p>
        </Card>
        <div className="no-print flex flex-col gap-6">
          <Card as="section" dense aria-labelledby="paid-title">
            <h2 id="paid-title" className="text-title tracking-normal">Payments on it</h2>
            {(s.payments ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">None made against this invoice. Payments towards your balance show on your statement.</p>
            ) : (
              <ul className="m-0 mt-3 list-none p-0">
                {(s.payments ?? []).map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border-t border-rule-2 py-2 text-sm">
                    <span>{METHOD[p.method]}, {formatDate(p.date)}</span>
                    <span className="flex items-center gap-2">
                      <MoneyText paisa={p.amountPaisa} />
                      <StatusBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Button variant="secondary" className="w-full" onClick={() => window.print()}>
            Print invoice
          </Button>
        </div>
      </div>
    </>
  );
}

// ---- payments ------------------------------------------------------------------------------------

const STATUSES = ["all", "pending", "confirmed", "bounced"] as const;
const STATUS_LINE: Record<PaymentStatus, string> = {
  pending: "Waiting for your supplier to confirm it. It lowers what you owe once confirmed.",
  confirmed: "Counted. It lowered what you owe.",
  bounced: "It did not clear, so it was not counted.",
};

export function ShopPayments() {
  const [url, setUrl] = useUrlState(["from", "to", "status", "sort"] as const);
  const range = useRange(url);
  const ok = range.from <= range.to;
  const status = STATUSES.find((s) => s === url.status) ?? "all";
  const filter = useMemo(() => ({ from: range.from, to: range.to, status: status === "all" ? undefined : status, pageSize: 200 }), [range.from, range.to, status]);
  const q = useApiQuery(["shopPortal", "payments", filter], (api) => api.shopPortal.payments(filter), { enabled: ok, placeholderData: (prev) => prev });
  const columns: Column<ShopPayment>[] = [
    { key: "date", header: "Date", cell: (p) => <span className="whitespace-nowrap">{formatDate(p.date)}</span>, sortValue: (p) => p.date, csv: (p) => p.date },
    {
      key: "method",
      header: "Method",
      rowHeader: true,
      cell: (p) => <>{METHOD[p.method]}{p.chequeNo ? <span className="text-sm text-muted"> · cheque {p.chequeNo}{p.bank ? `, ${p.bank}` : ""}</span> : p.reference ? <span className="text-sm text-muted"> · {p.reference}</span> : null}</>,
      sortValue: (p) => p.method,
      csv: (p) => [METHOD[p.method], p.chequeNo, p.bank, p.reference].filter(Boolean).join(" "),
    },
    { key: "for", header: "For", cell: (p) => (p.invoiceNo ? `Invoice ${p.invoiceNo}` : "Your balance"), csv: (p) => (p.invoiceNo ? `Invoice ${p.invoiceNo}` : "Balance") },
    { key: "amount", header: "Amount", numeric: true, cell: (p) => <MoneyText paisa={p.amountPaisa} />, sortValue: (p) => p.amountPaisa, csv: (p) => plain(p.amountPaisa) },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];
  return (
    <>
      <PageHeader title="Payments" lead={`${formatDate(range.from)} to ${formatDate(range.to)}`} actions={<><ExportButton filename={`payments-${range.from}-${range.to}.csv`} columns={columns} rows={q.data?.items} /><PrintButton /></>} />
      <div className="no-print mb-4 flex flex-col gap-4">
        <Segmented
          label="Payment status"
          value={status}
          onChange={(v) => setUrl({ status: v === "all" ? "" : v })}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "confirmed", label: "Confirmed" },
            { value: "bounced", label: "Bounced" },
          ]}
        />
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      {status !== "all" ? <p className="mb-3 text-ink-2">{STATUS_LINE[status]}</p> : null}
      <Table
        caption="Your payments"
        columns={columns}
        rows={ok ? q.data?.items : []}
        rowKey={(p) => p.id}
        loading={ok && q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={{ title: status === "all" ? "No payments in these dates" : `No ${status} payments in these dates`, line: "Try a wider date range." }}
      />
      <ul className="m-0 mt-4 list-none p-0 text-sm text-muted">
        {(["pending", "confirmed", "bounced"] as const).map((s) => (
          <li key={s} className="mt-1 flex items-center gap-2">
            <StatusBadge status={s} /> {STATUS_LINE[s]}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- returns -------------------------------------------------------------------------------------

export function ShopReturns() {
  const [url, setUrl] = useUrlState(["from", "to", "sort"] as const);
  const range = useRange(url);
  const ok = range.from <= range.to;
  const filter = useMemo(() => ({ from: range.from, to: range.to, pageSize: 200 }), [range.from, range.to]);
  const q = useApiQuery(["shopPortal", "returns", filter], (api) => api.shopPortal.returns(filter), { enabled: ok, placeholderData: (prev) => prev });
  const items = (r: ShopReturn) => r.lines.map((l) => `${countUnits(l.units, l.unitName)} of ${l.productName} (${REASON[l.reason]})`).join("; ");
  const columns: Column<ShopReturn>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>, sortValue: (r) => r.date, csv: (r) => r.date },
    { key: "items", header: "Goods sent back", rowHeader: true, cell: items, csv: items },
    { key: "value", header: "Credited", numeric: true, cell: (r) => <MoneyText paisa={r.valuePaisa} />, sortValue: (r) => r.valuePaisa, csv: (r) => plain(r.valuePaisa) },
  ];
  const total = (q.data?.items ?? []).reduce((a, r) => a + r.valuePaisa, 0);
  return (
    <>
      <PageHeader title="Returns" lead={`${formatDate(range.from)} to ${formatDate(range.to)}`} actions={<><ExportButton filename={`returns-${range.from}-${range.to}.csv`} columns={columns} rows={q.data?.items} /><PrintButton /></>} />
      <div className="no-print mb-4">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      <Table
        caption="Your returns"
        columns={columns}
        rows={ok ? q.data?.items : []}
        rowKey={(r) => r.id}
        loading={ok && q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        totals={{ label: "Total credited", cells: { value: <MoneyText paisa={total} /> } }}
        empty={{ title: "No returns in these dates", line: "Goods you send back show up here, with what they took off your balance." }}
      />
    </>
  );
}

// ---- profile -------------------------------------------------------------------------------------

export function ShopProfile() {
  const q = useApiQuery(["shopPortal", "me"], (api) => api.shopPortal.me());
  if (q.isPending) return <LoadingState label="Loading your profile" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const me = q.data;
  const rows: [string, string][] = [
    ["Shop name", me.shopName],
    ["Owner", me.ownerName],
    ["Phone", me.phone],
    ["Address", me.address],
    ...(me.pan ? ([["PAN", me.pan]] as [string, string][]) : []),
    ...(me.registrationNo ? ([["Registration number", me.registrationNo]] as [string, string][]) : []),
    ...(me.loginEmail ? ([["Sign-in email", me.loginEmail]] as [string, string][]) : []),
  ];
  return (
    <>
      <PageHeader title="Profile" lead={`Your details as ${me.business.name} has them.`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="section" className="lg:col-span-2" aria-label="Your details">
          <dl className="m-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="m-0 mt-0.5 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 border-t border-rule-2 pt-4 text-sm text-ink-2">
            Something wrong? Call {me.business.name}
            {me.business.phone ? ` on ${me.business.phone}` : ""} and they will change it.
          </p>
        </Card>
        <Card as="section" dense aria-labelledby="pw-title">
          <h2 id="pw-title" className="text-title tracking-normal">
            Password
          </h2>
          <p className="mt-2 text-ink-2">Change the password you sign in with. You stay signed in.</p>
          <Link href="/app/change-password" className={buttonClass("secondary", "md", "mt-4 w-full")}>
            Change password
          </Link>
        </Card>
      </div>
    </>
  );
}
