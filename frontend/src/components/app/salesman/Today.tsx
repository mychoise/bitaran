"use client";

// The salesman's Today. Planned: the route, its shops and the stock, with a big Start day.
// In progress: how far along, today's sales and cash, the next shop, and Close day.
// Closed: a read-only summary. No plan: says so plainly.

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { DayReport } from "@/lib/api/types";
import { formatDate, formatTime } from "@/lib/dates";
import { cartonEquivalent, countUnits } from "@/lib/units";
import { DAY_AFFECTS, useToday } from "./useToday";

export function Today() {
  const { plan, report } = useToday();
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  if (plan.isPending) return <LoadingState label="Loading today" />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data) return <EmptyState title="No plan for today" line="Your manager has not given you a route for today. When they do, it shows here." />;
  if (report.isPending) return <LoadingState label="Loading today" />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  const route = routes.data?.find((r) => r.id === plan.data!.routeId);
  const r = report.data;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-ink-2">{formatDate(r.plan.date)}</p>
      <h1 className="mt-1 text-display-s">{route?.name ?? "Today's route"}</h1>
      <p className="mt-3">
        <StatusBadge status={r.plan.status} />
      </p>
      <div className="mt-8">
        {r.plan.status === "planned" ? <Planned report={r} /> : r.plan.status === "in_progress" ? <InProgress report={r} /> : <Closed report={r} />}
      </div>
    </div>
  );
}

function StockSummary({ report: r }: { report: DayReport }) {
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const p = (id: string) => products.data?.items.find((x) => x.id === id);
  return (
    <Card as="section" dense aria-labelledby="carry-title">
      <h2 id="carry-title" className="text-title tracking-normal">
        Stock you carry
      </h2>
      <ul className="m-0 mt-3 list-none p-0">
        {r.stock.map((l) => {
          const product = p(l.productId);
          const unit = product?.unitName ?? "unit";
          const cartons = cartonEquivalent(l.issued, product?.unitsPerCarton ?? null, unit);
          return (
            <li key={l.productId} className="flex justify-between gap-3 border-t border-rule-2 py-2.5">
              <span className="min-w-0">{product?.name ?? "…"}</span>
              <span className="shrink-0 text-right font-outlier">
                {countUnits(l.issued, unit)}
                {cartons ? <span className="block text-xs text-muted">{cartons}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Planned({ report: r }: { report: DayReport }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const start = useApiMutation((api) => api.dayPlans.start(r.plan.id), DAY_AFFECTS);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg">
        {r.plan.visits.length} shop{r.plan.visits.length === 1 ? "" : "s"} to visit today, in order.
      </p>
      <StockSummary report={r} />
      <div>
        <Button
          size="lg"
          className="w-full"
          loading={start.isPending}
          loadingLabel="Starting…"
          onClick={async () => {
            setProblem(null);
            try {
              await start.mutateAsync(undefined);
              toast("Day started. Your first shop is waiting.");
            } catch (e) {
              setProblem(errorMessage(e));
            }
          }}
        >
          Start day
        </Button>
        <FormProblem message={problem} />
      </div>
    </div>
  );
}

function InProgress({ report: r }: { report: DayReport }) {
  const shops = useApiQuery(["dayPlans", "shops", r.plan.id], (api) => api.dayPlans.shops(r.plan.id));
  const done = r.visits.visited + r.visits.skipped;
  const total = done + r.visits.pending;
  const next = shops.data?.find((v) => v.visit.status === "pending");
  return (
    <div className="flex flex-col gap-6">
      <Card as="section" dense aria-label="How far along">
        <p className="text-lg">
          <span className="font-outlier text-2xl">{done}</span> of {total} shops done
        </p>
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-3 block h-2 w-full" aria-hidden>
          <rect width="100" height="6" rx="3" className="fill-paper-3" />
          <rect width={total ? (done / total) * 100 : 0} height="6" rx="3" className="fill-accent-2" />
        </svg>
        <dl className="m-0 mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">Sales today</dt>
            <dd className="m-0 mt-1 text-xl">
              <MoneyText paisa={r.sales.totalPaisa} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Cash collected</dt>
            <dd className="m-0 mt-1 text-xl">
              <MoneyText paisa={r.cash.collectedPaisa} />
            </dd>
          </div>
        </dl>
      </Card>
      {next ? (
        <Card as="section" dense aria-label="Next shop">
          <p className="text-sm text-muted">Next shop</p>
          <p className="mt-1 text-title font-semibold">{next.shop.name}</p>
          <p className="text-ink-2">{next.shop.address}</p>
          <Link href={`/app/salesman/shops/${next.visit.id}`} className={buttonClass("primary", "lg", "mt-4 w-full")}>
            Open {next.shop.name}
          </Link>
        </Card>
      ) : shops.data ? (
        <p className="text-lg">Every shop is visited or skipped. You can close the day.</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/app/salesman/shops" className={buttonClass("secondary", "lg", "w-full")}>
          All shops
        </Link>
        <Link href="/app/salesman/close-day" className={buttonClass("secondary", "lg", "w-full")}>
          Close day
        </Link>
      </div>
    </div>
  );
}

function Closed({ report: r }: { report: DayReport }) {
  return (
    <Card as="section" aria-label="Your day">
      <p className="text-lg">
        Day closed{r.plan.closedAt ? ` at ${formatTime(r.plan.closedAt)}` : ""}. {r.plan.status === "reconciled" ? "Your manager has counted it." : "Your manager will count it."}
      </p>
      <dl className="m-0 mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-muted">Shops</dt>
          <dd className="m-0 mt-1">
            {r.visits.visited} visited, {r.visits.skipped} skipped
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Sales</dt>
          <dd className="m-0 mt-1">
            <MoneyText paisa={r.sales.totalPaisa} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Cash collected</dt>
          <dd className="m-0 mt-1">
            <MoneyText paisa={r.cash.collectedPaisa} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Cash handed over</dt>
          <dd className="m-0 mt-1">{r.cash.handedOverPaisa === null ? "Not given" : <MoneyText paisa={r.cash.handedOverPaisa} />}</dd>
        </div>
      </dl>
      <Link href="/app/salesman/close-day" className={buttonClass("secondary", "md", "mt-6")}>
        See what you handed back
      </Link>
    </Card>
  );
}
