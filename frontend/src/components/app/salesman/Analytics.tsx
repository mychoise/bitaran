"use client";

// My numbers over a date range: totals, payments by method, sales per day (chart, or table),
// shop by shop, and the top products.

import { useMemo } from "react";
import { BarChart } from "@/components/ui/BarChart";
import { DateRangePicker, presetRange, type Range } from "@/components/ui/Controls";
import { Card, MoneyText } from "@/components/ui/Display";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApi, useApiQuery } from "@/lib/api/provider";
import { addDays, daysBetween, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { useUrlState } from "@/lib/url-state";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const METHOD = { cash: "Cash", cheque: "Cheque", online: "Online" } as const;

export function Analytics() {
  const { viewer } = useApi();
  const [url, setUrl] = useUrlState(["from", "to"] as const);
  const fallback = presetRange("month");
  const range: Range = { from: DATE.test(url.from) ? url.from : fallback.from, to: DATE.test(url.to) ? url.to : fallback.to };
  const q = useApiQuery(["reports", "salesman", viewer.id, range], (api) => api.reports.salesmanAnalytics(viewer.id, range), { placeholderData: (prev) => prev });
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));

  // Every day in the range gets a bar, so quiet days show as gaps rather than disappearing.
  const bars = useMemo(() => {
    if (!q.data) return [];
    const by = new Map(q.data.perDay.map((d) => [d.date, d]));
    const n = Math.min(92, daysBetween(range.from, range.to) + 1);
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(range.from, i);
      const d = by.get(date);
      return { key: date, label: formatDate(date).replace(/ \d{4}$/, ""), value: d?.totalPaisa ?? 0, display: d ? `${formatMoney(d.totalPaisa)}, ${d.count} sale${d.count === 1 ? "" : "s"}` : "No sales" };
    });
  }, [q.data, range.from, range.to]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-display-s">My numbers</h1>
      <div className="mt-6">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      {q.isPending ? (
        <LoadingState label="Working out your numbers" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <dl className="m-0 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Sales", formatMoney(q.data.sales.totalPaisa), `${q.data.sales.count} invoice${q.data.sales.count === 1 ? "" : "s"}`],
              ["Collected", formatMoney(q.data.payments.reduce((a, p) => a + p.amountPaisa, 0)), `${q.data.payments.reduce((a, p) => a + p.pendingCount, 0)} pending`],
              ["Returns credited", formatMoney(q.data.returnsPaisa), ""],
              ["My expenses", formatMoney(q.data.expensesPaisa), ""],
            ].map(([k, v, note]) => (
              <Card key={k} dense>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="m-0 mt-1 font-outlier text-xl">{v}</dd>
                {note ? <dd className="m-0 text-sm text-ink-2">{note}</dd> : null}
              </Card>
            ))}
          </dl>

          <Card as="section" dense className="mt-6" aria-label="Sales per day">
            <BarChart title="Sales per day" valueLabel="Sales" bars={bars} />
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card as="section" dense aria-labelledby="pay-title">
              <h2 id="pay-title" className="text-title tracking-normal">
                Payments by method
              </h2>
              {q.data.payments.length === 0 ? (
                <p className="mt-2 text-ink-2">None in these dates.</p>
              ) : (
                <ul className="m-0 mt-3 list-none p-0">
                  {q.data.payments.map((p) => (
                    <li key={p.method} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                      <span>
                        {METHOD[p.method]}
                        <span className="block text-sm text-muted">
                          {p.count} payment{p.count === 1 ? "" : "s"}
                          {p.pendingCount ? `, ${p.pendingCount} pending` : ""}
                        </span>
                      </span>
                      <MoneyText paisa={p.amountPaisa} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card as="section" dense aria-labelledby="shop-title">
              <h2 id="shop-title" className="text-title tracking-normal">
                By shop
              </h2>
              <ol className="m-0 mt-3 list-none p-0">
                {q.data.perShop.slice(0, 8).map((s) => (
                  <li key={s.shopId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                    <span>
                      {shops.data?.items.find((x) => x.id === s.shopId)?.name ?? "…"}
                      <span className="block text-sm text-muted">
                        {s.count} sale{s.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <MoneyText paisa={s.totalPaisa} />
                  </li>
                ))}
              </ol>
              {q.data.perShop.length === 0 ? <p className="mt-2 text-ink-2">No sales in these dates.</p> : null}
            </Card>
            <Card as="section" dense aria-labelledby="top-title">
              <h2 id="top-title" className="text-title tracking-normal">
                Top products
              </h2>
              <ol className="m-0 mt-3 list-none p-0">
                {q.data.topProducts.map((t) => {
                  const p = products.data?.items.find((x) => x.id === t.productId);
                  return (
                    <li key={t.productId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                      <span>
                        {p?.name ?? "…"}
                        <span className="block text-sm text-muted">{countUnits(t.baseUnits, p?.unitName ?? "unit")}</span>
                      </span>
                      <MoneyText paisa={t.totalPaisa} />
                    </li>
                  );
                })}
              </ol>
              {q.data.topProducts.length === 0 ? <p className="mt-2 text-ink-2">No sales in these dates.</p> : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
