"use client";

// Sales: every invoice, with what has been paid against it. Filter by dates, salesman, shop and
// status. One sale: the printable invoice, its payments, who sold it, and Cancel sale.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Select, Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { canCancelSale, cancelledGoodsGo } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Payment, Sale, SaleStatus } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { DateFilter, okDate, SalesmanFilter } from "./filters";
import { InvoiceItems } from "./InvoiceItems";

const plain = (p: number) => formatAmount(p).replace(/,/g, "");
const METHOD: Record<Payment["method"], string> = { cash: "Cash", cheque: "Cheque", online: "Online" };

export function SaleList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["from", "to", "salesman", "shop", "status", "sort"] as const);
  const status: SaleStatus | undefined = url.status === "confirmed" || url.status === "cancelled" ? url.status : undefined;
  const filter = useMemo(
    () => ({ from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, salesmanId: url.salesman || undefined, shopId: url.shop || undefined, status, pageSize: 200 }),
    [url.from, url.to, url.salesman, url.shop, status],
  );
  const q = useApiQuery(["sales", "list", filter], (api) => api.sales.list(filter), { placeholderData: (prev) => prev });
  const filtered = Boolean(url.from || url.to || url.salesman || url.shop || status);
  const shopName = (id: string) => look.shop(id)?.name ?? "…";

  const columns: Column<Sale>[] = [
    { key: "no", header: "Invoice", rowHeader: true, cell: (s) => <Link href={`/app/manager/sales/${s.id}`} className="text-link font-outlier">{s.invoiceNo}</Link>, sortValue: (s) => s.invoiceNo },
    { key: "date", header: "Date", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.date)}</span>, sortValue: (s) => s.date, csv: (s) => s.date },
    { key: "shop", header: "Shop", cell: (s) => shopName(s.shopId), sortValue: (s) => shopName(s.shopId) },
    { key: "salesman", header: "Salesman", cell: (s) => look.person(s.salesmanId), sortValue: (s) => look.person(s.salesmanId) },
    { key: "items", header: "Items", cell: (s) => <InvoiceItems saleId={s.id} lines={s.lines} />, csv: (s) => s.lines.length || "" },
    { key: "total", header: "Total", numeric: true, cell: (s) => <MoneyText paisa={s.totalPaisa} />, sortValue: (s) => s.totalPaisa, csv: (s) => plain(s.totalPaisa) },
    { key: "paid", header: "Paid", numeric: true, cell: (s) => <MoneyText paisa={s.paidPaisa ?? 0} />, sortValue: (s) => s.paidPaisa ?? 0, csv: (s) => plain(s.paidPaisa ?? 0) },
    { key: "due", header: "Due", cell: (s) => <span className="whitespace-nowrap">{s.dueDate ? formatDate(s.dueDate) : "None"}</span>, sortValue: (s) => s.dueDate ?? "", csv: (s) => s.dueDate ?? "" },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];
  const clear = () => setUrl({ from: "", to: "", salesman: "", shop: "", status: "" });

  return (
    <>
      <PageHeader title="Sales" lead="Every invoice, and what has been paid against it." actions={<ExportButton filename="sales.csv" columns={columns} rows={q.data?.items} />} />
      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
        <SalesmanFilter salesmen={look.salesmen} value={url.salesman} onChange={(v) => setUrl({ salesman: v })} />
        <div className="lg:w-56">
          <Select label="Shop" size="sm" value={url.shop} onChange={(e) => setUrl({ shop: e.target.value })}>
            <option value="">All shops</option>
            {look.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-44">
          <Select label="Status" size="sm" value={status ?? ""} onChange={(e) => setUrl({ status: e.target.value })}>
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={clear}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {q.data ? `${q.data.total} sale${q.data.total === 1 ? "" : "s"}${filtered ? " match" : ""}` : " "}
      </p>
      <Table
        caption="Sales"
        columns={columns}
        rows={q.data?.items}
        rowKey={(s) => s.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={filtered ? { title: "No sales match", line: "Try other filters, or clear them.", action: <Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button> } : { title: "No sales yet", line: "Sales your salesmen make show up here." }}
      />
    </>
  );
}

export function SaleDetail({ id }: { id: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["sales", "detail", id], (api) => api.sales.get(id));
  const pays = useApiQuery(["payments", "list", { saleId: id }], (api) => api.payments.list({ saleId: id, pageSize: 50 }));
  const business = useApiQuery(["business"], (api) => api.business.get());
  const [cancelling, setCancelling] = useState(false);
  if (q.isPending) return <LoadingState label="Loading the invoice" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found") return <EmptyState title="This sale was not found" line="Go back to the sales list." action={<Link href="/app/manager/sales" className={buttonClass("secondary", "sm")}>Back to sales</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const s = q.data;
  const shop = look.shop(s.shopId);
  const payments = pays.data?.items ?? [];
  const can = canCancelSale(s, payments);
  const credit = s.totalPaisa - (s.paidPaisa ?? 0);

  return (
    <>
      <BackLink href="/app/manager/sales" label="Sales" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="article" className="lg:col-span-2" aria-labelledby="invoice-title">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <p className="font-semibold">{business.data?.name}</p>
              <p className="text-sm text-ink-2">{business.data ? `${business.data.address}, ${business.data.city}` : ""}</p>
              <p className="text-sm text-ink-2">{business.data ? `PAN ${business.data.pan}` : ""}</p>
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
                {shop ? <Link href={`/app/manager/shops/${shop.id}`} className="text-link font-medium">{shop.name}</Link> : "…"}
                <span className="block text-ink-2">{shop?.address}</span>
                {shop?.pan ? <span className="block text-ink-2">PAN {shop.pan}</span> : null}
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
                {s.lines.map((l) => {
                  const p = look.product(l.productId);
                  return (
                    <tr key={`${l.productId}-${l.unit}`}>
                      <th scope="row" className="font-normal">{p?.name ?? "…"}</th>
                      <td className="num">{l.unit === "carton" ? `${l.quantity} carton${l.quantity === 1 ? "" : "s"}` : countUnits(l.quantity, p?.unitName ?? "unit")}</td>
                      <td className="num"><MoneyText paisa={l.pricePaisa} /></td>
                      <td className="num"><MoneyText paisa={l.totalPaisa} /></td>
                    </tr>
                  );
                })}
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
            <div className="flex justify-between"><dt>Paid</dt><dd className="m-0"><MoneyText paisa={s.paidPaisa ?? 0} /></dd></div>
            {s.status === "confirmed" && credit > 0 ? <div className="flex justify-between"><dt>Still owed</dt><dd className="m-0"><MoneyText paisa={credit} /></dd></div> : null}
          </dl>
          {s.status === "cancelled" ? (
            <p className="mt-4 rounded-input border border-rule-2 bg-paper-3 p-3 text-sm">
              Cancelled {s.cancelledAt ? formatDateTime(s.cancelledAt) : ""}
              {s.cancelledBy ? ` by ${look.person(s.cancelledBy)}` : ""}: {s.cancelReason}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-muted">
            Sold by {look.person(s.salesmanId)}.
          </p>
        </Card>

        <div className="no-print flex flex-col gap-6">
          <Card as="section" dense aria-labelledby="pay-title">
            <h2 id="pay-title" className="text-title tracking-normal">Payments against it</h2>
            {pays.isPending ? (
              <LoadingState label="Loading payments" lines={2} />
            ) : payments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">None linked to this invoice. Payments towards the shop&apos;s balance show on the shop.</p>
            ) : (
              <ul className="m-0 mt-3 list-none p-0">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-t border-rule-2 py-2 text-sm">
                    <Link href={`/app/manager/payments/${p.id}`} className="text-link">
                      {METHOD[p.method]}, {formatDate(p.date)}
                    </Link>
                    <span className="flex items-center gap-2">
                      <MoneyText paisa={p.amountPaisa} />
                      <StatusBadge status={p.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card as="section" dense aria-label="Actions">
            <Button variant="secondary" className="w-full" onClick={() => window.print()}>
              Print invoice
            </Button>
            {s.planId ? (
              <Link href={`/app/manager/day-plans/${s.planId}`} className={buttonClass("quiet", "md", "mt-2 w-full")}>
                That day&apos;s plan
              </Link>
            ) : null}
            {s.status === "confirmed" ? (
              can.ok ? (
                <Button variant="secondary" className="mt-3 w-full" onClick={() => setCancelling(true)}>
                  Cancel sale
                </Button>
              ) : (
                <p className="mt-3 text-sm text-ink-2">
                  <span className="font-medium text-ink">This sale cannot be cancelled.</span> {can.reason}
                </p>
              )
            ) : null}
          </Card>
        </div>
      </div>
      {cancelling ? <CancelSale sale={s} onClose={() => setCancelling(false)} /> : null}
    </>
  );
}

function CancelSale({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const toast = useToast();
  const look = usePlanLookups();
  const plans = useApiQuery(["dayPlans", "detail", sale.planId ?? "none"], (api) => api.dayPlans.get(sale.planId!), { enabled: Boolean(sale.planId) });
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = useApiMutation((api, r: string) => api.sales.cancel(sale.id, r), [["sales"], ["shops"], ["dayPlans"], ["products"], ["reports"]]);
  const goes = cancelledGoodsGo(plans.data?.status);
  const error = tried && !reason.trim() ? "Say why the sale is cancelled." : reason.length > 200 ? "Keep the reason under 200 characters." : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel invoice ${sale.invoiceNo}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button
            loading={cancel.isPending}
            loadingLabel="Cancelling…"
            onClick={async () => {
              setTried(true);
              if (!reason.trim() || reason.length > 200) return;
              setProblem(null);
              try {
                await cancel.mutateAsync(reason);
                onClose();
                toast(`Invoice ${sale.invoiceNo} cancelled.`);
              } catch (e) {
                setProblem(errorMessage(e));
              }
            }}
          >
            Cancel sale
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">
        It no longer counts for {look.shop(sale.shopId)?.name ?? "the shop"}: <MoneyText paisa={sale.totalPaisa} /> comes off what it owes. The invoice keeps its number.{" "}
        {goes === "salesman" ? "The goods count as still with the salesman, and are counted back at reconcile." : "The goods go back into the warehouse stock."} This cannot be undone.
      </p>
      <Textarea label="Reason" hint="Required. Kept with the invoice." value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      <FormProblem message={problem} />
    </Modal>
  );
}
