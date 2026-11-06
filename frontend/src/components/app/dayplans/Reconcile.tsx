"use client";

// Reconcile: the manager counts what came back. For each product: issued, sold, the salesman's
// own count and the manager's count, with the shortage worked out as you type. Then the cash:
// collected in cash against handed over and counted. Once confirmed, this page is the read-only,
// printable end-of-day report.

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { DayReport } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { WHOLE } from "@/lib/forms";
import { formatAmount, formatMoney, parseRupees } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { usePlanLookups } from "./lookups";

export function ReconcilePage({ id }: { id: string }) {
  const q = useApiQuery(["dayPlans", "report", id], (api) => api.dayPlans.report(id));
  const look = usePlanLookups();
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return <EmptyState title="This day plan was not found" line="It may have been deleted while it was still planned." action={<Link href="/app/manager/day-plans" className={buttonClass("secondary", "sm")}>Back to day plans</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  if (look.error) return <ErrorState message={errorMessage(look.error)} onRetry={look.retry} />;
  if (q.isPending || !look.ready) return <LoadingState label="Loading this day" />;
  const r = q.data;
  const p = r.plan;
  const title = `${formatDate(p.date)}: ${look.person(p.salesmanId)}`;
  const back = <BackLink href={`/app/manager/day-plans/${p.id}`} label="This day plan" />;

  if (p.status === "reconciled") return <>{back}<DayReportView report={r} /></>;
  if (p.status !== "closed")
    return (
      <>
        {back}
        <PageHeader title={`Reconcile ${title}`} actions={<StatusBadge status={p.status} />} />
        <EmptyState
          title="Not ready to count yet"
          line={p.status === "planned" ? "This day has not started. It can be counted once the salesman has closed it." : "The salesman is still on the route. It can be counted once they close the day."}
          action={<Link href={`/app/manager/day-plans/${p.id}`} className={buttonClass("secondary", "sm")}>Back to the plan</Link>}
        />
      </>
    );
  return (
    <>
      {back}
      <PageHeader title={`Reconcile ${title}`} lead={look.route(p.routeId)?.name} actions={<StatusBadge status={p.status} />} />
      <ReconcileForm report={r} />
    </>
  );
}

function ReconcileForm({ report: r }: { report: DayReport }) {
  const look = usePlanLookups();
  const toast = useToast();
  const p = r.plan;
  // Start from the salesman's own numbers; the manager changes what does not match.
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(r.stock.map((l) => [l.productId, String(l.reportedUnsold ?? 0)])));
  const [cash, setCash] = useState(formatAmount(r.cash.handedOverPaisa ?? 0));
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reconcile = useApiMutation((api, input: Parameters<typeof api.dayPlans.reconcile>[1]) => api.dayPlans.reconcile(p.id, input), [["dayPlans"], ["products"], ["reports"]]);

  const rows = r.stock.map((l) => {
    const raw = counts[l.productId] ?? "";
    const count = WHOLE.test(raw) ? Number(raw) : null;
    const shortage = count === null ? null : l.remaining - count;
    const error = count === null ? "Enter a whole number, zero or more." : shortage! < 0 ? `More than could be left: at most ${l.remaining}.` : null;
    return { line: l, count, shortage, error };
  });
  const cashCounted = parseRupees(cash);
  const difference = cashCounted === null ? null : cashCounted - r.cash.collectedPaisa;
  const short = rows.reduce((a, x) => a + Math.max(0, x.shortage ?? 0), 0);
  const ok = rows.every((x) => !x.error) && cashCounted !== null && notes.length <= 1000;
  const back = rows.reduce((a, x) => a + (x.count ?? 0), 0);

  const onConfirm = async () => {
    setProblem(null);
    try {
      await reconcile.mutateAsync({ counted: rows.map((x) => ({ productId: x.line.productId, units: x.count! })), cashCountedPaisa: cashCounted!, notes });
      setConfirming(false);
      toast("Day reconciled. The counted stock is back in the warehouse.");
    } catch (e) {
      setConfirming(false);
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <Card as="section" dense aria-labelledby="count-title">
        <h2 id="count-title" className="text-title tracking-normal">
          Count the stock
        </h2>
        <p className="mt-1 text-sm text-ink-2">Each box starts with the salesman&apos;s own count. Change it to what you count. Your count is what is kept.</p>
        <div className="table-scroll mt-4">
          <table className="data-table">
            <caption className="visually-hidden">Stock to count back</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" className="num">Issued</th>
                <th scope="col" className="num">Sold</th>
                <th scope="col" className="num">Salesman counted</th>
                <th scope="col">Your count</th>
                <th scope="col" className="num">Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line: l, shortage, error }) => {
                const product = look.product(l.productId);
                const unit = product?.unitName ?? "unit";
                return (
                  <tr key={l.productId}>
                    <th scope="row" className="font-medium">
                      {product?.name ?? "…"}
                      {l.writtenOff ? <span className="block text-xs text-muted">{countUnits(l.writtenOff, unit)} written off</span> : null}
                    </th>
                    <td className="num">{countUnits(l.issued, unit)}</td>
                    <td className="num">{countUnits(l.sold, unit)}</td>
                    <td className="num">{countUnits(l.reportedUnsold ?? 0, unit)}</td>
                    <td className="min-w-36">
                      <Input
                        label={`Your count of ${product?.name ?? "this product"}`}
                        hideLabel
                        size="sm"
                        inputMode="numeric"
                        autoComplete="off"
                        value={counts[l.productId] ?? ""}
                        error={error && (tried || counts[l.productId] !== String(l.reportedUnsold ?? 0)) ? error : undefined}
                        onChange={(e) => setCounts({ ...counts, [l.productId]: e.target.value })}
                      />
                    </td>
                    <td className="num" aria-live="polite">
                      {shortage === null || shortage < 0 ? "" : shortage === 0 ? <span className="text-muted">None</span> : <span className="font-semibold text-error">{countUnits(shortage, unit)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-2" aria-live="polite">
          {short ? `${short} unit${short === 1 ? "" : "s"} short in all.` : "Nothing short so far."}
        </p>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card as="section" dense aria-labelledby="cash-title">
          <h2 id="cash-title" className="text-title tracking-normal">
            Check the cash
          </h2>
          <dl className="m-0 mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Cash collected (cash payments on this plan)</dt>
              <dd className="m-0">
                <MoneyText paisa={r.cash.collectedPaisa} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Handed over by the salesman</dt>
              <dd className="m-0">{r.cash.handedOverPaisa === null ? "Not given" : <MoneyText paisa={r.cash.handedOverPaisa} />}</dd>
            </div>
          </dl>
          <div className="mt-4 max-w-xs">
            <Input label="Cash you counted (Rs)" inputMode="decimal" autoComplete="off" value={cash} error={tried && cashCounted === null ? "Enter the cash in rupees, like 6,600." : undefined} onChange={(e) => setCash(e.target.value)} />
          </div>
          <p className={`text-sm font-medium ${difference === null ? "text-muted" : difference < 0 ? "text-error" : difference > 0 ? "text-warning" : "text-success"}`} aria-live="polite">
            {difference === null ? "Enter the cash to see the difference." : difference === 0 ? "Matches the cash collected." : difference < 0 ? `Short by ${formatMoney(-difference)}.` : `Over by ${formatMoney(difference)}.`}
          </p>
        </Card>

        <Card as="section" dense aria-labelledby="notes-title">
          <h2 id="notes-title" className="text-title tracking-normal">
            Notes
          </h2>
          <div className="mt-4">
            <Textarea label="Anything to remember about this day" hint="Optional. Kept with the report." value={notes} error={notes.length > 1000 ? "Keep the notes under 1,000 characters." : undefined} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </Card>
      </div>

      <FormProblem message={problem} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => {
            setTried(true);
            if (ok) setConfirming(true);
          }}
        >
          Reconcile this day
        </Button>
        <Link href={`/app/manager/day-plans/${p.id}`} className={buttonClass("secondary")}>
          Go back
        </Link>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onConfirm}
        busy={reconcile.isPending}
        title="Reconcile this day?"
        consequence={`${back} unit${back === 1 ? "" : "s"} go back into the warehouse. ${short ? `${short} unit${short === 1 ? " is" : "s are"} recorded as short. ` : ""}${difference ? `The cash is ${difference < 0 ? "short" : "over"} by ${formatMoney(Math.abs(difference))}. ` : ""}After this the day cannot be changed.`}
        confirmLabel="Reconcile"
      />
    </>
  );
}

/** The end-of-day report: read-only and made to print. */
export function DayReportView({ report: r }: { report: DayReport }) {
  const look = usePlanLookups();
  const p = r.plan;
  const short = r.stock.reduce((a, l) => a + (l.shortage ?? 0), 0);
  return (
    <article aria-labelledby="report-title">
      <header className="mb-8 flex flex-col gap-4 border-b-2 border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">End-of-day report</p>
          <h1 id="report-title" className="text-section">
            {formatDate(p.date)}: {look.person(p.salesmanId)}
          </h1>
          <p className="mt-2 text-lg text-ink-2">{look.route(p.routeId)?.name}</p>
        </div>
        <div className="no-print flex items-center gap-3">
          <StatusBadge status={p.status} />
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print report
          </Button>
        </div>
      </header>

      <dl className="m-0 grid grid-cols-2 gap-6 md:grid-cols-4">
        {[
          ["Shops visited", `${r.visits.visited} of ${r.visits.visited + r.visits.skipped + r.visits.pending}${r.visits.skipped ? `, ${r.visits.skipped} skipped` : ""}`],
          ["Sales", `${r.sales.count}, ${formatMoney(r.sales.totalPaisa)}`],
          ["Cash collected", formatMoney(r.cash.collectedPaisa)],
          ["Shortage", short ? `${short} unit${short === 1 ? "" : "s"}` : "None"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="m-0 mt-1 font-outlier text-lg">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-title tracking-normal">Stock</h2>
      <div className="table-scroll mt-3">
        <table className="data-table">
          <caption className="visually-hidden">Stock issued, sold and counted back</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="num">Issued</th>
              <th scope="col" className="num">Sold</th>
              <th scope="col" className="num">Written off</th>
              <th scope="col" className="num">Salesman counted</th>
              <th scope="col" className="num">Counted back</th>
              <th scope="col" className="num">Shortage</th>
            </tr>
          </thead>
          <tbody>
            {r.stock.map((l) => {
              const unit = look.product(l.productId)?.unitName ?? "unit";
              return (
                <tr key={l.productId}>
                  <th scope="row" className="font-medium">{look.product(l.productId)?.name ?? "…"}</th>
                  <td className="num">{countUnits(l.issued, unit)}</td>
                  <td className="num">{countUnits(l.sold, unit)}</td>
                  <td className="num">{l.writtenOff ? countUnits(l.writtenOff, unit) : "None"}</td>
                  <td className="num">{l.reportedUnsold === null ? "" : countUnits(l.reportedUnsold, unit)}</td>
                  <td className="num">{l.counted === null ? "" : countUnits(l.counted, unit)}</td>
                  <td className={`num ${l.shortage ? "font-semibold text-error" : ""}`}>{l.shortage ? countUnits(l.shortage, unit) : "None"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        <section aria-labelledby="report-cash">
          <h2 id="report-cash" className="text-title tracking-normal">
            Cash
          </h2>
          <dl className="m-0 mt-3 flex flex-col gap-2">
            {[
              ["Collected in cash", r.cash.collectedPaisa],
              ["The salesman handed over", r.cash.handedOverPaisa],
              ["Counted by the manager", r.cash.countedPaisa],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 border-b border-rule-2 pb-2">
                <dt className="text-ink-2">{k}</dt>
                <dd className="m-0">{v === null ? "Not given" : <MoneyText paisa={v as number} />}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="font-semibold">Difference</dt>
              <dd className={`m-0 font-semibold ${r.cash.differencePaisa ? "text-error" : "text-success"}`}>
                {r.cash.differencePaisa === null ? "" : r.cash.differencePaisa === 0 ? "None" : `${r.cash.differencePaisa < 0 ? "Short" : "Over"} ${formatMoney(Math.abs(r.cash.differencePaisa))}`}
              </dd>
            </div>
          </dl>
          {r.payments.some((x) => x.method !== "cash") ? (
            <p className="mt-3 text-sm text-ink-2">
              Also taken:{" "}
              {r.payments
                .filter((x) => x.method !== "cash")
                .map((x) => `${x.count} ${x.method} payment${x.count === 1 ? "" : "s"}, ${formatMoney(x.amountPaisa)}${x.pendingCount ? ` (${x.pendingCount} pending)` : ""}`)
                .join("; ")}
              .
            </p>
          ) : null}
        </section>
        <section aria-labelledby="report-notes">
          <h2 id="report-notes" className="text-title tracking-normal">
            Notes
          </h2>
          <p className="mt-3 whitespace-pre-line text-ink-2">{p.reconcileNotes || "No notes."}</p>
          <p className="mt-4 text-sm text-muted">
            Reconciled {p.reconciledAt ? formatDateTime(p.reconciledAt) : ""}
            {p.reconciledBy ? ` by ${look.person(p.reconciledBy)}` : ""}.
          </p>
        </section>
      </div>
    </article>
  );
}
