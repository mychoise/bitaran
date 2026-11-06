"use client";

// Closing the day, one stage at a time: every shop visited or skipped, then the stock left (worked
// out from what was issued, sold and written off; never typed), then the cash handed over, then a
// review and a confirm. Once closed, a read-only
// summary of what was handed back.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { DayReport, Product } from "@/lib/api/types";
import { formatTime } from "@/lib/dates";
import { formatAmount, formatMoney, parseRupees } from "@/lib/money";
import { cartonEquivalent, countUnits } from "@/lib/units";
import { DAY_AFFECTS, useToday } from "./useToday";

const STAGES = ["Shops", "Stock left", "Cash", "Review"] as const;

export function CloseDay() {
  const { plan, report } = useToday();
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const byId = useMemo(() => new Map((products.data?.items ?? []).map((p) => [p.id, p])), [products.data]);
  if (plan.isPending) return <LoadingState label="Loading your day" />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data)
    return (
      <>
        <h1 className="visually-hidden">Close the day</h1>
        <EmptyState title="No plan for today" line="There is nothing to close." />
      </>
    );
  if (report.isPending || products.isPending) return <LoadingState label="Loading your day" />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  const r = report.data;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">Close day</h1>
      {r.plan.status === "planned" ? (
        <EmptyState title="The day has not started" line="Start it on Today first. It can be closed at the end of the route." action={<Link href="/app/salesman" className={buttonClass("secondary", "sm")}>Today</Link>} />
      ) : r.plan.status === "in_progress" ? (
        <Wizard report={r} product={(id) => byId.get(id)} />
      ) : (
        <ClosedSummary report={r} product={(id) => byId.get(id)} />
      )}
    </div>
  );
}

function Wizard({ report: r, product }: { report: DayReport; product: (id: string) => Product | undefined }) {
  const toast = useToast();
  const shops = useApiQuery(["dayPlans", "shops", r.plan.id], (api) => api.dayPlans.shops(r.plan.id));
  const [stage, setStage] = useState(0);
  const [cash, setCash] = useState(formatAmount(r.cash.collectedPaisa));
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const close = useApiMutation((api, input: { reportedUnsold: { productId: string; units: number }[]; cashHandedOverPaisa: number }) => api.dayPlans.close(r.plan.id, input), DAY_AFFECTS);

  const pending = shops.data?.filter((v) => v.visit.status === "pending") ?? [];
  const cashPaisa = parseRupees(cash);
  const canGo = [pending.length === 0 && Boolean(shops.data), true, cashPaisa !== null, true];

  const onClose = async () => {
    setProblem(null);
    try {
      await close.mutateAsync({ reportedUnsold: r.stock.map((l) => ({ productId: l.productId, units: l.remaining })), cashHandedOverPaisa: cashPaisa! });
      setConfirming(false);
      toast("Day closed. Hand the stock and cash to your manager.");
    } catch (e) {
      setConfirming(false);
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <ol className="m-0 mt-6 flex list-none items-start justify-between p-0" aria-label="Stages">
        {STAGES.map((s, i) => (
          <li key={s} className="day-point flex flex-1 flex-col items-center gap-1 text-center" data-state={i < stage ? "done" : i === stage ? "now" : "next"} aria-current={i === stage ? "step" : undefined}>
            <span className="day-point-dot" aria-hidden />
            <span className="text-sm">{s}</span>
          </li>
        ))}
      </ol>

      <Card as="section" className="mt-6" aria-label={STAGES[stage]}>
        {stage === 0 ? (
          shops.isPending ? (
            <LoadingState label="Loading your shops" lines={3} />
          ) : shops.isError ? (
            <ErrorState message={errorMessage(shops.error)} onRetry={() => shops.refetch()} />
          ) : pending.length ? (
            <>
              <h2 className="text-title tracking-normal">
                {pending.length} shop{pending.length === 1 ? "" : "s"} still to visit or skip
              </h2>
              <p className="mt-1 text-ink-2">Every shop has to be visited or skipped before the day can close.</p>
              <ul className="m-0 mt-4 list-none p-0">
                {pending.map((v) => (
                  <li key={v.visit.id} className="flex items-center justify-between gap-3 border-t border-rule-2 py-3">
                    <span>
                      <span className="block font-medium">{v.shop.name}</span>
                      <span className="block text-sm text-muted">{v.shop.address}</span>
                    </span>
                    <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("secondary", "sm")}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-title tracking-normal">Every shop is done</h2>
              <p className="mt-1 text-ink-2">
                {r.visits.visited} visited, {r.visits.skipped} skipped.
              </p>
            </>
          )
        ) : stage === 1 ? (
          <>
            <h2 className="text-title tracking-normal">Stock left with you</h2>
            <p className="mt-1 text-ink-2">Worked out from your sales: what was issued, less what you sold and any write-off. Hand this back to your manager, who counts it.</p>
            <div className="table-scroll mt-4">
              <table className="data-table">
                <caption className="visually-hidden">Stock left, product by product</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="num">Issued</th>
                    <th scope="col" className="num">Sold</th>
                    {r.stock.some((l) => l.writtenOff) ? <th scope="col" className="num">Written off</th> : null}
                    <th scope="col" className="num">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {r.stock.map((l) => {
                    const p = product(l.productId);
                    const unit = p?.unitName ?? "unit";
                    const cartons = cartonEquivalent(l.remaining, p?.unitsPerCarton ?? null, unit);
                    return (
                      <tr key={l.productId}>
                        <th scope="row" className="font-medium">{p?.name ?? "…"}</th>
                        <td className="num">{countUnits(l.issued, unit)}</td>
                        <td className="num">{countUnits(l.sold, unit)}</td>
                        {r.stock.some((x) => x.writtenOff) ? <td className="num">{l.writtenOff ? countUnits(l.writtenOff, unit) : "None"}</td> : null}
                        <td className="num font-semibold">
                          {countUnits(l.remaining, unit)}
                          {cartons ? <span className="block text-sm font-normal text-muted">{cartons}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : stage === 2 ? (
          <>
            <h2 className="text-title tracking-normal">Cash you hand over</h2>
            <p className="mt-1 text-ink-2">
              You collected <MoneyText paisa={r.cash.collectedPaisa} /> in cash today. Cheques and online payments are not part of this.
            </p>
            <div className="mt-4 max-w-xs">
              <Input label="Cash handed over (Rs)" inputMode="decimal" size="lg" autoComplete="off" value={cash} error={cashPaisa === null ? "Enter the cash in rupees, like 6,600." : undefined} onChange={(e) => setCash(e.target.value)} />
            </div>
            {cashPaisa !== null && cashPaisa !== r.cash.collectedPaisa ? (
              <p className="text-sm font-medium text-error">
                {cashPaisa < r.cash.collectedPaisa ? `Rs ${formatAmount(r.cash.collectedPaisa - cashPaisa)} less than you collected.` : `Rs ${formatAmount(cashPaisa - r.cash.collectedPaisa)} more than you collected.`}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-title tracking-normal">Check before closing</h2>
            <dl className="m-0 mt-4 flex flex-col gap-2">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Shops</dt>
                <dd className="m-0 text-right">
                  {r.visits.visited} visited, {r.visits.skipped} skipped
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Sales</dt>
                <dd className="m-0 text-right">
                  {r.sales.count}, <MoneyText paisa={r.sales.totalPaisa} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Cash handed over</dt>
                <dd className="m-0 text-right">{cashPaisa === null ? "" : <MoneyText paisa={cashPaisa} />}</dd>
              </div>
            </dl>
            <h3 className="mt-5 text-sm font-semibold tracking-wide text-muted uppercase">Stock you hand back</h3>
            <ul className="m-0 mt-2 list-none p-0 text-sm">
              {r.stock.map((l) => {
                const p = product(l.productId);
                return (
                  <li key={l.productId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                    <span>{p?.name ?? "…"}</span>
                    <span className="font-outlier">{countUnits(l.remaining, p?.unitName ?? "unit")}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <FormProblem message={problem} />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" disabled={stage === 0} onClick={() => setStage(stage - 1)}>
          Back
        </Button>
        {stage < STAGES.length - 1 ? (
          <Button size="lg" disabled={!canGo[stage]} onClick={() => setStage(stage + 1)}>
            Next
          </Button>
        ) : (
          <Button size="lg" onClick={() => setConfirming(true)}>
            Close my day
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onClose}
        busy={close.isPending}
        title="Close your day?"
        consequence={`You hand back ${cashPaisa === null ? "the cash" : formatMoney(cashPaisa)} and the stock left with you. After this nothing on today's route can change; your manager counts it next.`}
        confirmLabel="Close day"
      />
    </>
  );
}

function ClosedSummary({ report: r, product }: { report: DayReport; product: (id: string) => Product | undefined }) {
  return (
    <Card as="section" className="mt-6" aria-label="What you handed back">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg">Closed{r.plan.closedAt ? ` at ${formatTime(r.plan.closedAt)}` : ""}.</p>
        <StatusBadge status={r.plan.status} />
      </div>
      <dl className="m-0 mt-4 flex flex-col gap-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Cash collected</dt>
          <dd className="m-0">
            <MoneyText paisa={r.cash.collectedPaisa} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Cash handed over</dt>
          <dd className="m-0">{r.cash.handedOverPaisa === null ? "Not given" : <MoneyText paisa={r.cash.handedOverPaisa} />}</dd>
        </div>
      </dl>
      <h2 className="mt-5 text-sm font-semibold tracking-wide text-muted uppercase">Stock handed back</h2>
      <ul className="m-0 mt-2 list-none p-0 text-sm">
        {r.stock.map((l) => {
          const p = product(l.productId);
          return (
            <li key={l.productId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
              <span>{p?.name ?? "…"}</span>
              <span className="font-outlier">{countUnits(l.reportedUnsold ?? 0, p?.unitName ?? "unit")}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">{r.plan.status === "reconciled" ? "Your manager has counted this day." : "Your manager counts it next."}</p>
    </Card>
  );
}
