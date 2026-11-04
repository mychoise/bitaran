"use client";

// One day plan: where it is in its day, the stock (issued, sold, remaining), the shops in route
// order, and that day's sales and payments. Delete while still planned (the stock goes back);
// reconcile once the salesman has closed the day.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { BackLink } from "@/components/ui/Form";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { DayPlan, DayReport, DayStockLine, Payment, Sale } from "@/lib/api/types";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { countUnits } from "@/lib/units";
import { usePlanLookups } from "./lookups";

const STEPS: { status: DayPlan["status"]; label: string; at: (p: DayPlan) => string | undefined }[] = [
  { status: "planned", label: "Planned", at: (p) => p.createdAt },
  { status: "in_progress", label: "Started", at: (p) => p.startedAt },
  { status: "closed", label: "Closed", at: (p) => p.closedAt },
  { status: "reconciled", label: "Reconciled", at: (p) => p.reconciledAt },
];

export function PlanDetail({ id }: { id: string }) {
  const q = useApiQuery(["dayPlans", "report", id], (api) => api.dayPlans.report(id));
  const look = usePlanLookups();
  if (q.isPending) return <LoadingState label="Loading this day plan" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/manager/day-plans" label="Day plans" />
          <EmptyState title="This day plan was not found" line="It may have been deleted while it was still planned." action={<Link href="/app/manager/day-plans" className={buttonClass("secondary", "sm")}>Back to day plans</Link>} />
        </>
      );
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const r = q.data;
  const p = r.plan;
  const route = look.route(p.routeId);
  return (
    <>
      <BackLink href="/app/manager/day-plans" label="Day plans" />
      <PageHeader
        title={`${formatDate(p.date)}: ${look.person(p.salesmanId)}`}
        lead={route ? <Link href={`/app/manager/routes/${route.id}`} className="text-link">{route.name}</Link> : "…"}
        actions={<StatusBadge status={p.status} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Timeline plan={p} />
          <StockTable report={r} />
          <Visits plan={p} />
          <DaySales planId={p.id} />
          <DayPayments planId={p.id} />
        </div>
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <Summary report={r} />
          <Actions plan={p} />
        </div>
      </div>
    </>
  );
}

function Timeline({ plan }: { plan: DayPlan }) {
  const at = STEPS.findIndex((s) => s.status === plan.status);
  return (
    <Card as="section" dense aria-label="Where this day is">
      <ol className="m-0 flex list-none items-start justify-between p-0">
        {STEPS.map((s, i) => {
          const when = s.at(plan);
          return (
            <li key={s.status} className="day-point flex flex-1 flex-col items-center gap-1 text-center" data-state={i < at ? "done" : i === at ? "now" : "next"} aria-current={i === at ? "step" : undefined}>
              <span className="day-point-dot" aria-hidden />
              <span className="text-sm">{s.label}</span>
              <span className="text-xs text-muted">{when && i <= at ? formatDateTime(when) : i <= at ? "" : "Not yet"}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function StockTable({ report }: { report: DayReport }) {
  const look = usePlanLookups();
  const p = report.plan;
  const counted = p.status === "reconciled";
  const unit = (l: DayStockLine) => look.product(l.productId)?.unitName ?? "unit";
  const columns: Column<DayStockLine>[] = [
    { key: "product", header: "Product", rowHeader: true, cell: (l) => look.product(l.productId)?.name ?? "…", sortValue: (l) => look.product(l.productId)?.name ?? "" },
    { key: "issued", header: "Issued", numeric: true, cell: (l) => countUnits(l.issued, unit(l)), sortValue: (l) => l.issued },
    { key: "sold", header: "Sold", numeric: true, cell: (l) => countUnits(l.sold, unit(l)), sortValue: (l) => l.sold },
    { key: "remaining", header: counted ? "Should be left" : "Remaining", numeric: true, cell: (l) => countUnits(l.remaining, unit(l)), sortValue: (l) => l.remaining },
    ...(p.reportedUnsold && !counted ? [{ key: "reported", header: "Salesman counted", numeric: true, cell: (l: DayStockLine) => (l.reportedUnsold === null ? "" : countUnits(l.reportedUnsold, unit(l))), sortValue: (l: DayStockLine) => l.reportedUnsold ?? 0 }] : []),
    ...(counted
      ? [
          { key: "counted", header: "Counted back", numeric: true, cell: (l: DayStockLine) => countUnits(l.counted ?? 0, unit(l)), sortValue: (l: DayStockLine) => l.counted ?? 0 },
          { key: "short", header: "Shortage", numeric: true, cell: (l: DayStockLine) => <span className={l.shortage ? "font-semibold text-error" : "text-muted"}>{l.shortage ? countUnits(l.shortage, unit(l)) : "None"}</span>, sortValue: (l: DayStockLine) => l.shortage ?? 0 },
        ]
      : []),
  ];
  return (
    <section aria-labelledby="stock-title">
      <h2 id="stock-title" className="mb-3 text-title tracking-normal">
        Stock
      </h2>
      <Table caption="Stock on this day plan" columns={columns} rows={report.stock} rowKey={(l) => l.productId} empty={{ title: "No stock issued", line: "This plan has no stock lines." }} />
    </section>
  );
}

function Visits({ plan }: { plan: DayPlan }) {
  const look = usePlanLookups();
  return (
    <Card as="section" dense aria-labelledby="visits-title">
      <h2 id="visits-title" className="text-title tracking-normal">
        Shops in route order
      </h2>
      <ol className="m-0 mt-3 list-none p-0">
        {plan.visits.map((v, i) => {
          const shop = look.shop(v.shopId);
          return (
            <li key={v.shopId} className="flex items-center gap-3 border-t border-rule-2 py-2.5">
              <span className="w-6 text-right font-outlier text-muted" aria-hidden>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                {shop ? (
                  <Link href={`/app/manager/shops/${shop.id}`} className="text-link font-medium">
                    {shop.name}
                  </Link>
                ) : (
                  "…"
                )}
                <span className="block text-sm text-muted">
                  {v.status === "visited" && v.at ? `Visited at ${formatTime(v.at)}` : v.status === "skipped" ? `Skipped${v.skipReason ? `: ${v.skipReason}` : ""}` : "Not visited yet"}
                </span>
              </span>
              {v.status === "pending" ? <StatusBadge status="pending" label="To visit" /> : <StatusBadge status={v.status} />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function DaySales({ planId }: { planId: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["sales", "list", { planId }], (api) => api.sales.list({ planId, pageSize: 200 }));
  const columns: Column<Sale>[] = [
    { key: "no", header: "Invoice", rowHeader: true, cell: (s) => <span className="font-outlier">{s.invoiceNo}</span>, sortValue: (s) => s.invoiceNo },
    { key: "shop", header: "Shop", cell: (s) => <Link href={`/app/manager/shops/${s.shopId}?tab=sales`} className="text-link">{look.shop(s.shopId)?.name ?? "…"}</Link>, sortValue: (s) => look.shop(s.shopId)?.name ?? "" },
    { key: "time", header: "Time", cell: (s) => formatTime(s.createdAt), sortValue: (s) => s.createdAt },
    { key: "total", header: "Total", numeric: true, cell: (s) => <MoneyText paisa={s.totalPaisa} />, sortValue: (s) => s.totalPaisa },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];
  return (
    <section id="sales" aria-labelledby="sales-title">
      <h2 id="sales-title" className="mb-3 text-title tracking-normal">
        Sales that day
      </h2>
      <Table caption="Sales on this day plan" columns={columns} rows={q.data?.items} rowKey={(s) => s.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "No sales on this plan", line: "Sales the salesman makes on this route show up here." }} />
    </section>
  );
}

const METHOD: Record<Payment["method"], string> = { cash: "Cash", cheque: "Cheque", online: "Online" };

function DayPayments({ planId }: { planId: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["payments", "list", { planId }], (api) => api.payments.list({ planId, pageSize: 200 }));
  const columns: Column<Payment>[] = [
    { key: "shop", header: "Shop", rowHeader: true, cell: (p) => <Link href={`/app/manager/shops/${p.shopId}?tab=payments`} className="text-link">{look.shop(p.shopId)?.name ?? "…"}</Link>, sortValue: (p) => look.shop(p.shopId)?.name ?? "" },
    { key: "method", header: "Method", cell: (p) => METHOD[p.method], sortValue: (p) => p.method },
    { key: "amount", header: "Amount", numeric: true, cell: (p) => <MoneyText paisa={p.amountPaisa} />, sortValue: (p) => p.amountPaisa },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];
  return (
    <section id="payments" aria-labelledby="payments-title">
      <h2 id="payments-title" className="mb-3 text-title tracking-normal">
        Payments that day
      </h2>
      <Table caption="Payments on this day plan" columns={columns} rows={q.data?.items} rowKey={(p) => p.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "No payments on this plan", line: "Payments taken on this route show up here." }} />
    </section>
  );
}

function Summary({ report: r }: { report: DayReport }) {
  return (
    <Card as="section" dense aria-label="The day in numbers">
      <dl className="m-0 flex flex-col gap-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Shops</dt>
          <dd className="m-0 text-right">
            {r.visits.visited} visited, {r.visits.skipped} skipped, {r.visits.pending} to go
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <a href="#sales" className="text-link">
              Sales
            </a>
          </dt>
          <dd className="m-0 text-right">
            {r.sales.count}, <MoneyText paisa={r.sales.totalPaisa} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <a href="#payments" className="text-link">
              Cash collected
            </a>
          </dt>
          <dd className="m-0 text-right">
            <MoneyText paisa={r.cash.collectedPaisa} />
          </dd>
        </div>
        {r.payments
          .filter((x) => x.method !== "cash")
          .map((x) => (
            <div key={x.method} className="flex justify-between gap-4">
              <dt className="text-muted">{METHOD[x.method]}</dt>
              <dd className="m-0 text-right">
                <MoneyText paisa={x.amountPaisa} />
                {x.pendingCount ? <span className="block text-xs text-muted">{x.pendingCount} pending</span> : null}
              </dd>
            </div>
          ))}
      </dl>
    </Card>
  );
}

function Actions({ plan }: { plan: DayPlan }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const remove = useApiMutation((api) => api.dayPlans.remove(plan.id), [["dayPlans"], ["products"], ["reports"]]);
  const onDelete = async () => {
    try {
      await remove.mutateAsync(undefined);
      toast("Day plan deleted. Its stock is back in the warehouse.");
      router.push("/app/manager/day-plans");
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      setOpen(false);
    }
  };
  return (
    <Card as="section" dense aria-label="What can be done">
      {plan.status === "planned" ? (
        <>
          <p className="text-sm text-ink-2">Not started yet. Deleting it puts all its stock back in the warehouse.</p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}>
            Delete this plan
          </Button>
        </>
      ) : plan.status === "in_progress" ? (
        <p className="text-sm text-ink-2">The salesman is on the route. Once the day is closed, you can count it back here.</p>
      ) : plan.status === "closed" ? (
        <>
          <p className="text-sm text-ink-2">The salesman has closed the day. Count the stock and cash that came back.</p>
          <Link href={`/app/manager/day-plans/${plan.id}/reconcile`} className={buttonClass("primary", "md", "mt-4 w-full")}>
            Reconcile this day
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">Counted and closed for good.</p>
          <Link href={`/app/manager/day-plans/${plan.id}/reconcile`} className={buttonClass("secondary", "md", "mt-4 w-full")}>
            End-of-day report
          </Link>
        </>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        busy={remove.isPending}
        danger
        title="Delete this day plan?"
        consequence="All of its stock goes back to the warehouse. This cannot be undone."
        confirmLabel="Delete plan"
      />
    </Card>
  );
}
