"use client";

// The first screen of each area. Step 1 shows live demo data through the ApiClient so the
// data path, loading, empty and error states are real; the full screens come in later steps.

import Link from "next/link";
import { Card, MoneyText, PageHeader, Stat, StatusBadge } from "@/components/ui/Display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { formatDate, formatTime, todayNepal } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { errorMessage, useApiQuery } from "@/lib/api/provider";

export function ManagerToday() {
  const q = useApiQuery(["reports", "dashboard"], (api) => api.reports.dashboard());
  const d = q.data;
  return (
    <>
      <PageHeader title="Today" lead={formatDate(todayNepal())} />
      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card dense>
            <Stat label="Sales today" loading={q.isPending} value={d ? <MoneyText paisa={d.salesTodayPaisa} /> : null} note={d ? `${d.salesTodayCount} invoice${d.salesTodayCount === 1 ? "" : "s"}` : undefined} />
          </Card>
          <Card dense>
            <Stat label="Collected today" loading={q.isPending} value={d ? <MoneyText paisa={d.collectedTodayPaisa} /> : null} note={d ? <>In clearing: <MoneyText paisa={d.inClearingPaisa} /></> : undefined} />
          </Card>
          <Card dense>
            <Stat label="Overdue udharo" loading={q.isPending} value={d ? <MoneyText paisa={d.overduePaisa} /> : null} note={d ? `${d.overdueShopCount} shop${d.overdueShopCount === 1 ? "" : "s"}` : undefined} />
          </Card>
          <Card dense>
            <Stat label="Needs a look" loading={q.isPending} value={d ? d.lowStockCount + d.flaggedPhotoCount : null} note={d ? `${d.lowStockCount} low stock, ${d.flaggedPhotoCount} flagged photos` : undefined} />
          </Card>
        </div>
      )}
      {d ? (
        <Card className="mt-6" dense>
          <h2 className="text-title tracking-normal">Day plans today</h2>
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-3 p-0">
            {(["planned", "in_progress", "closed", "reconciled"] as const).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <StatusBadge status={s} />
                <span className="font-outlier">{d.plansByStatus[s]}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export function SalesmanToday() {
  const plan = useApiQuery(["dayPlans", "today"], (api) => api.dayPlans.today());
  const routes = useApiQuery(["shops", "routes"], (api) => api.shops.routes());
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  if (plan.isPending) return <LoadingState label="Loading today" />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  const p = plan.data;
  if (!p) return <EmptyState title="No route today" line="Your manager has not given you a route for today. When they do, it shows here." />;
  const route = routes.data?.find((r) => r.id === p.routeId);
  const count = (status: string) => p.visits.filter((v) => v.status === status).length;
  const shop = (id: string) => shops.data?.items.find((s) => s.id === id);
  const units = p.issued.reduce((a, l) => a + l.units, 0);
  return (
    <>
      <PageHeader title={route?.name ?? "Today's route"} lead={formatDate(p.date)} />
      {/* Phones: the summary first, then the shops. Desktop: shops on the left, summary beside them. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card dense className="lg:sticky lg:top-24 lg:col-start-3 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={p.status} />
            <span className="text-ink-2">
              {p.visits.length - count("pending")} of {p.visits.length} shops done
            </span>
          </div>
          <dl className="m-0 mt-5 grid grid-cols-3 gap-4 lg:grid-cols-1">
            {[
              ["Visited", count("visited")],
              ["Skipped", count("skipped")],
              ["To visit", count("pending")],
            ].map(([label, n]) => (
              <div key={label} className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="m-0 font-outlier text-2xl leading-tight">{n}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-rule-2 pt-4 text-sm text-ink-2">
            Stock issued: {p.issued.length} product{p.issued.length === 1 ? "" : "s"}, {units} units
          </p>
        </Card>
        <section aria-labelledby="route-shops" className="lg:col-span-2 lg:row-start-1">
          <h2 id="route-shops" className="text-title tracking-normal">
            Shops on this route
          </h2>
          <ol className="m-0 mt-4 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
            {p.visits.map((v, i) => {
              const s = shop(v.shopId);
              return (
                <li key={v.shopId}>
                  <Card dense className="flex h-full items-center gap-4">
                    <span className="w-6 font-outlier text-lg text-muted">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-lg font-medium">{s?.name ?? "…"}</span>
                      {s ? (
                        <span className="text-sm text-ink-2">
                          Balance <MoneyText paisa={s.balancePaisa} balance />
                          {v.at ? <> · visited {formatTime(v.at)}</> : null}
                        </span>
                      ) : null}
                    </span>
                    {v.status === "pending" ? <StatusBadge status="pending" label="To visit" /> : <StatusBadge status={v.status} />}
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </>
  );
}

const ENTRY_LABEL = { opening: "Opening", sale: "Invoice", payment: "Payment", return: "Return" } as const;

function RecentActivity() {
  const q = useApiQuery(["shopPortal", "statement", "all"], (api) => api.shopPortal.statement());
  const recent = (q.data ?? []).slice(-6).reverse();
  return (
    <Card as="section" dense className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-title tracking-normal">Recent activity</h2>
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
              <span className="text-right md:text-left">
                <span className="text-sm text-muted">{ENTRY_LABEL[e.kind]} </span>
                {e.ref}
              </span>
              <span className="md:text-right">
                {e.debitPaisa > 0 ? <MoneyText paisa={e.debitPaisa} /> : <span className="text-success">− <MoneyText paisa={e.creditPaisa} /></span>}
              </span>
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

export function ShopOverview() {
  const q = useApiQuery(["shopPortal", "summary"], (api) => api.shopPortal.summary());
  if (q.isPending) return <LoadingState label="Loading your balance" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const s = q.data;
  return (
    <>
      <PageHeader title={s.shopName} lead={`Your account with ${s.businessName}`} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="sm:col-span-2 xl:col-span-1">
          <Stat label={s.balancePaisa < 0 ? "Your credit" : "You owe"} value={<MoneyText paisa={s.balancePaisa} balance />} note={`Credit limit: ${formatMoney(s.creditLimitPaisa)}`} />
        </Card>
        <Card>
          <Stat label="In clearing" value={<MoneyText paisa={s.inClearingPaisa} />} note="Cheques and online payments not yet confirmed. They do not lower what you owe until they clear." />
        </Card>
        <Card>
          <Stat label="Overdue" value={<MoneyText paisa={s.overduePaisa} />} note={s.oldestOverdueDate ? `Oldest was due ${formatDate(s.oldestOverdueDate)}` : "Nothing overdue"} />
        </Card>
      </div>
      <RecentActivity />
    </>
  );
}
