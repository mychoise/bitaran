"use client";

// The manager's home: today at a glance. Each tile says what it shows and links to the screen
// with the detail.

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { BarChart } from "@/components/ui/BarChart";
import { Card, MoneyText, PageHeader, Skeleton, StatusBadge } from "@/components/ui/Display";
import { ErrorState } from "@/components/ui/States";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { addDays, daysBetween, formatDate, todayNepal } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { usePlanLookups } from "../dayplans/lookups";

function Tile({ title, href, linkText, children, className = "" }: { title: string; href: string; linkText: string; children: ReactNode; className?: string }) {
  return (
    <Card as="section" dense className={`flex flex-col gap-2 ${className}`} aria-label={title}>
      <h2 className="text-sm text-muted">{title}</h2>
      <div className="flex-1">{children}</div>
      <Link href={href} className="text-link text-sm">
        {linkText}
      </Link>
    </Card>
  );
}

const Big = ({ children }: { children: ReactNode }) => <p className="font-outlier text-2xl leading-tight whitespace-nowrap text-ink">{children}</p>;

export function ManagerDashboard() {
  const today = todayNepal();
  const look = usePlanLookups();
  const q = useApiQuery(["reports", "dashboard"], (api) => api.reports.dashboard());
  const range = useMemo(() => ({ from: addDays(today, -13), to: today }), [today]);
  const byDay = useApiQuery(["reports", "salesByDay", range], (api) => api.reports.salesByDay(range));
  const overdue = useApiQuery(["reports", "overdue"], (api) => api.reports.overdue());
  const low = useApiQuery(["reports", "lowStock"], (api) => api.reports.lowStock());
  const d = q.data;
  const day = `from=${today}&to=${today}`;

  const bars = useMemo(() => {
    const by = new Map((byDay.data ?? []).map((x) => [x.date, x]));
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(range.from, i);
      const x = by.get(date);
      return { key: date, label: formatDate(date).replace(/ \d{4}$/, ""), value: x?.totalPaisa ?? 0, display: x ? `${formatMoney(x.totalPaisa)}, ${x.count} sale${x.count === 1 ? "" : "s"}` : "No sales" };
    });
  }, [byDay.data, range.from]);

  if (q.isError) return (
    <>
      <PageHeader title="Today" lead={formatDate(today)} />
      <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
    </>
  );

  const wait = <Skeleton className="h-8 w-32" />;
  return (
    <>
      <PageHeader title="Today" lead={formatDate(today)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile title="Sales today" href={`/app/manager/sales?${day}`} linkText="See today's sales">
          {d ? (
            <>
              <Big>{formatMoney(d.salesTodayPaisa)}</Big>
              <p className="text-sm text-ink-2">
                {d.salesTodayCount} invoice{d.salesTodayCount === 1 ? "" : "s"}
              </p>
            </>
          ) : wait}
        </Tile>
        <Tile title="Cash collected today" href={`/app/manager/payments?method=cash&${day}`} linkText="See today's cash">
          {d ? (
            <>
              <Big>{formatMoney(d.cashTodayPaisa)}</Big>
              <p className="text-sm text-ink-2">All confirmed payments today: {formatMoney(d.collectedTodayPaisa)}</p>
            </>
          ) : wait}
        </Tile>
        <Tile title="Payments waiting for you" href="/app/manager/payments?status=pending" linkText="Confirm payments">
          {d ? (
            <>
              <Big>{d.pendingPaymentCount}</Big>
              <p className="text-sm text-ink-2">Cheques and online payments. In clearing: {formatMoney(d.inClearingPaisa)}</p>
            </>
          ) : wait}
        </Tile>
        <Tile title="Flagged photos" href="/app/manager/photos?flagged=1" linkText="Review photos">
          {d ? (
            <>
              <Big>{d.flaggedPhotoCount}</Big>
              <p className="text-sm text-ink-2">Visit photos worth a second look.</p>
            </>
          ) : wait}
        </Tile>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tile title="Day plans today" href={`/app/manager/day-plans?date=${today}`} linkText="See today's day plans">
          {d ? (
            <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
              {(["planned", "in_progress", "closed", "reconciled"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between gap-3">
                  <StatusBadge status={s} />
                  <span className="font-outlier text-lg">{d.plansByStatus[s]}</span>
                </li>
              ))}
            </ul>
          ) : wait}
        </Tile>
        <Tile title="Most overdue shops" href="/app/manager/reports/overdue" linkText="See all overdue credit">
          {overdue.isError ? (
            <p className="text-ink-2">Could not load this. {errorMessage(overdue.error)}</p>
          ) : !overdue.data ? (
            wait
          ) : overdue.data.length === 0 ? (
            <p className="text-ink-2">No shop has an overdue amount.</p>
          ) : (
            <ol className="m-0 list-none p-0">
              {overdue.data.slice(0, 5).map((o) => (
                <li key={o.shopId} className="flex items-baseline justify-between gap-3 border-t border-rule-2 py-2 first:border-t-0">
                  <span className="min-w-0">
                    <Link href={`/app/manager/shops/${o.shopId}`} className="text-link block truncate">
                      {look.shop(o.shopId)?.name ?? "…"}
                    </Link>
                    <span className="text-sm text-muted">{daysBetween(o.oldestDueDate, today)} days overdue</span>
                  </span>
                  <MoneyText paisa={o.overduePaisa} />
                </li>
              ))}
            </ol>
          )}
        </Tile>
        <Tile title="Low stock" href="/app/manager/reports/low-stock" linkText="See the low stock report">
          {low.isError ? (
            <p className="text-ink-2">Could not load this. {errorMessage(low.error)}</p>
          ) : !low.data ? (
            wait
          ) : low.data.length === 0 ? (
            <p className="text-ink-2">Every product is above its low-stock level.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {low.data.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 border-t border-rule-2 py-2 first:border-t-0">
                  <Link href={`/app/manager/products/${p.id}`} className="text-link min-w-0 truncate">
                    {p.name}
                  </Link>
                  <span className="text-sm whitespace-nowrap text-ink-2">{countUnits(p.stockUnits, p.unitName)} left</span>
                </li>
              ))}
              {low.data.length > 5 ? <li className="pt-1 text-sm text-muted">and {low.data.length - 5} more</li> : null}
            </ul>
          )}
        </Tile>
      </div>

      <Tile title="Sales, last 14 days" href={`/app/manager/sales?from=${range.from}&to=${range.to}`} linkText="See these sales" className="mt-4">
        {byDay.isError ? <ErrorState message={errorMessage(byDay.error)} onRetry={() => byDay.refetch()} /> : byDay.data ? <BarChart title="Sales per day, last 14 days" valueLabel="Sales" bars={bars} /> : <Skeleton className="h-56 w-full" />}
      </Tile>
    </>
  );
}
