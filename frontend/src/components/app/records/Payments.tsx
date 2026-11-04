"use client";

// Payments: "Pending" first, since those are waiting for the manager. One payment: its images
// (open to zoom), the method's details, the shop and salesman, and Confirm or Mark bounced.
// Once decided it is read-only.

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { ImageViewer, Segmented } from "@/components/ui/Controls";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { BackLink } from "@/components/ui/Form";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { DateFilter, okDate, SalesmanFilter } from "./filters";

const METHOD: Record<PaymentMethod, string> = { cash: "Cash", cheque: "Cheque", online: "Online" };
const STATUSES = ["pending", "all", "confirmed", "bounced"] as const;

export function PaymentList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["status", "method", "salesman", "from", "to", "sort"] as const);
  const status = (STATUSES as readonly string[]).includes(url.status) ? (url.status as (typeof STATUSES)[number]) : "all";
  const method = (["cash", "cheque", "online"] as const).find((m) => m === url.method);
  const filter = useMemo(
    () => ({ status: status === "all" ? undefined : (status as PaymentStatus), method, salesmanId: url.salesman || undefined, from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, pageSize: 200 }),
    [status, method, url.salesman, url.from, url.to],
  );
  const q = useApiQuery(["payments", "list", filter], (api) => api.payments.list(filter), { placeholderData: (prev) => prev });
  const pending = useApiQuery(["payments", "list", { status: "pending" }], (api) => api.payments.list({ status: "pending", pageSize: 1 }));
  const filtered = Boolean(status !== "all" || method || url.salesman || url.from || url.to);

  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", cell: (p) => <Link href={`/app/manager/payments/${p.id}`} className="text-link whitespace-nowrap">{formatDate(p.date)}</Link>, sortValue: (p) => p.createdAt, csv: (p) => p.date },
    { key: "shop", header: "Shop", rowHeader: true, cell: (p) => look.shop(p.shopId)?.name ?? "…", sortValue: (p) => look.shop(p.shopId)?.name ?? "" },
    { key: "salesman", header: "Salesman", cell: (p) => look.person(p.salesmanId), sortValue: (p) => look.person(p.salesmanId) },
    { key: "method", header: "Method", cell: (p) => <>{METHOD[p.method]}{p.chequeNo ? <span className="text-sm text-muted"> · {p.chequeNo}</span> : p.reference ? <span className="text-sm text-muted"> · {p.reference}</span> : null}</>, sortValue: (p) => p.method },
    { key: "amount", header: "Amount", numeric: true, cell: (p) => <MoneyText paisa={p.amountPaisa} />, sortValue: (p) => p.amountPaisa, csv: (p) => formatAmount(p.amountPaisa).replace(/,/g, "") },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];

  return (
    <>
      <PageHeader title="Payments" lead="Cheques and online payments wait here until you confirm them." actions={<ExportButton filename="payments.csv" columns={columns} rows={q.data?.items} />} />
      <div className="mb-4">
        <Segmented
          label="Payment status"
          value={status}
          onChange={(v) => setUrl({ status: v === "all" ? "" : v })}
          options={[
            { value: "pending", label: `Pending${pending.data ? ` (${pending.data.total})` : ""}` },
            { value: "all", label: "All" },
            { value: "confirmed", label: "Confirmed" },
            { value: "bounced", label: "Bounced" },
          ]}
        />
      </div>
      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <div className="lg:w-44">
          <Select label="Method" size="sm" value={method ?? ""} onChange={(e) => setUrl({ method: e.target.value })}>
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="online">Online</option>
          </Select>
        </div>
        <SalesmanFilter salesmen={look.salesmen} value={url.salesman} onChange={(v) => setUrl({ salesman: v })} />
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={() => setUrl({ status: "", method: "", salesman: "", from: "", to: "" })}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
      <Table
        caption="Payments"
        columns={columns}
        rows={q.data?.items}
        rowKey={(p) => p.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        empty={status === "pending" ? { title: "Nothing waiting", line: "Every cheque and online payment has been decided." } : { title: "No payments match", line: "Try other filters." }}
      />
    </>
  );
}

export function PaymentDetail({ id }: { id: string }) {
  const look = usePlanLookups();
  const toast = useToast();
  const q = useApiQuery(["payments", "detail", id], (api) => api.payments.get(id));
  const sale = useApiQuery(["sales", "detail", q.data?.saleId ?? "none"], (api) => api.sales.get(q.data!.saleId!), { enabled: Boolean(q.data?.saleId) });
  const [deciding, setDeciding] = useState<"confirmed" | "bounced" | null>(null);
  const decide = useApiMutation((api, status: "confirmed" | "bounced") => api.payments.decide(id, status), [["payments"], ["shops"], ["sales"], ["reports"], ["dayPlans"]]);
  if (q.isPending) return <LoadingState label="Loading the payment" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found") return <EmptyState title="This payment was not found" line="Go back to the payments." action={<Link href="/app/manager/payments" className={buttonClass("secondary", "sm")}>Back to payments</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const p = q.data;
  const shop = look.shop(p.shopId);
  const onConfirm = async () => {
    if (!deciding) return;
    try {
      await decide.mutateAsync(deciding);
      toast(deciding === "confirmed" ? "Payment confirmed. It now lowers what the shop owes." : "Marked bounced. The shop's balance stays as it was.");
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      setDeciding(null);
    }
  };
  const rows: [string, ReactNode][] = [
    ["Shop", shop ? <Link key="s" href={`/app/manager/shops/${shop.id}?tab=payments`} className="text-link">{shop.name}</Link> : "…"],
    ["Collected by", look.person(p.salesmanId)],
    ["When", formatDateTime(p.createdAt)],
    ["Method", METHOD[p.method]],
    ...(p.method === "cheque" ? ([["Cheque number", p.chequeNo ?? ""], ["Bank", p.bank ?? "Not given"], ["Date on the cheque", p.chequeDate ? formatDate(p.chequeDate) : "Not given"]] as [string, string][]) : []),
    ...(p.method === "online" ? ([["Reference", p.reference ?? "Not given"]] as [string, string][]) : []),
    ["For", p.saleId ? (sale.data ? <Link key="i" href={`/app/manager/sales/${p.saleId}`} className="text-link">Invoice {sale.data.invoiceNo}</Link> : "…") : "The shop's balance"],
  ];
  return (
    <>
      <BackLink href="/app/manager/payments" label="Payments" />
      <PageHeader title={formatMoney(p.amountPaisa)} lead={`${METHOD[p.method]} from ${shop?.name ?? "…"}`} actions={<StatusBadge status={p.status} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="section" dense className="lg:col-span-2" aria-label="Details">
          <dl className="m-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="m-0 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          {p.imageIds.length ? (
            <div className="mt-6 border-t border-rule-2 pt-4">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{p.method === "cheque" ? "Cheque photo" : "Payment screenshot"}</h2>
              <p className="mb-3 text-sm text-ink-2">Open it to look closely.</p>
              <div className="flex flex-wrap gap-3">
                {(p.imageUrls ?? []).map((src, i) => (src ? <ImageViewer key={i} src={src} alt={`${p.method === "cheque" ? "Cheque" : "Screenshot"} ${i + 1} for this payment`} /> : null))}
              </div>
            </div>
          ) : null}
        </Card>
        <Card as="section" dense aria-label="Decision">
          {p.status === "pending" ? (
            <>
              <p className="text-ink-2">Pending. It does not lower what the shop owes until you confirm it.</p>
              <Button className="mt-4 w-full" onClick={() => setDeciding("confirmed")}>
                Confirm payment
              </Button>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setDeciding("bounced")}>
                Mark bounced
              </Button>
            </>
          ) : (
            <p className="text-ink-2">
              {p.status === "confirmed" ? "Confirmed" : "Marked bounced"}
              {p.decidedAt ? ` ${formatDateTime(p.decidedAt)}` : ""}
              {p.decidedBy ? ` by ${look.person(p.decidedBy)}` : p.method === "cash" ? " at once, as cash" : ""}. This cannot change now.
            </p>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        onConfirm={onConfirm}
        busy={decide.isPending}
        danger={deciding === "bounced"}
        title={deciding === "confirmed" ? `Confirm ${formatMoney(p.amountPaisa)} from ${shop?.name ?? "the shop"}?` : "Mark this payment bounced?"}
        consequence={deciding === "confirmed" ? "It lowers what the shop owes now. This cannot be changed later." : "The shop's balance stays as it is, since the payment never counted. This cannot be changed later."}
        confirmLabel={deciding === "confirmed" ? "Confirm payment" : "Mark bounced"}
      />
    </>
  );
}
