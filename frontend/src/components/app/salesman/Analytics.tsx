"use client";

// My numbers over a date range: totals, payments by method, sales per day (chart, or table),
// shop by shop, and the top products.

import { useTranslations } from "next-intl";
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

export function Analytics() {
  const t = useTranslations("Salesman.analytics");
  const tMethod = useTranslations("Labels.method");
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
      return { key: date, label: formatDate(date).replace(/ \d{4}$/, ""), value: d?.totalPaisa ?? 0, display: d ? `${formatMoney(d.totalPaisa)}, ${t("saleCount", { count: d.count })}` : t("noSalesInDates") };
    });
  }, [q.data, range.from, range.to, t]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <div className="mt-6">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
      </div>
      {q.isPending ? (
        <LoadingState label={t("loading")} />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <dl className="m-0 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t("sold"), formatMoney(q.data.sales.totalPaisa), t("soldNote", { count: q.data.sales.count })],
              [t("collected"), formatMoney(q.data.payments.reduce((a, p) => a + p.amountPaisa, 0)), t("collectedNote", { count: q.data.payments.reduce((a, p) => a + p.pendingCount, 0) })],
              [t("returnsCredited"), formatMoney(q.data.returnsPaisa), ""],
              [t("myExpenses"), formatMoney(q.data.expensesPaisa), ""],
            ].map(([k, v, note]) => (
              <Card key={k} dense>
                <dt className="text-sm text-muted">{k}</dt>
                <dd className="m-0 mt-1 font-outlier text-xl">{v}</dd>
                {note ? <dd className="m-0 text-sm text-ink-2">{note}</dd> : null}
              </Card>
            ))}
          </dl>

          <Card as="section" dense className="mt-6" aria-label={t("salesPerDay")}>
            <BarChart title={t("salesPerDay")} valueLabel={t("sold")} bars={bars} />
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card as="section" dense aria-labelledby="pay-title">
              <h2 id="pay-title" className="text-title tracking-normal">
                {t("paymentsByMethod")}
              </h2>
              {q.data.payments.length === 0 ? (
                <p className="mt-2 text-ink-2">{t("noneInDates")}</p>
              ) : (
                <ul className="m-0 mt-3 list-none p-0">
                  {q.data.payments.map((p) => (
                    <li key={p.method} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                      <span>
                        {tMethod(p.method)}
                        <span className="block text-sm text-muted">
                          {t("paymentCount", { count: p.count })}
                          {p.pendingCount ? t("pendingSuffix", { count: p.pendingCount }) : ""}
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
                {t("byShop")}
              </h2>
              <ol className="m-0 mt-3 list-none p-0">
                {q.data.perShop.slice(0, 8).map((s) => (
                  <li key={s.shopId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                    <span>
                      {shops.data?.items.find((x) => x.id === s.shopId)?.name ?? "…"}
                      <span className="block text-sm text-muted">{t("saleCount", { count: s.count })}</span>
                    </span>
                    <MoneyText paisa={s.totalPaisa} />
                  </li>
                ))}
              </ol>
              {q.data.perShop.length === 0 ? <p className="mt-2 text-ink-2">{t("noSalesInDates")}</p> : null}
            </Card>
            <Card as="section" dense aria-labelledby="top-title">
              <h2 id="top-title" className="text-title tracking-normal">
                {t("topProducts")}
              </h2>
              <ol className="m-0 mt-3 list-none p-0">
                {q.data.topProducts.map((tp) => {
                  const p = products.data?.items.find((x) => x.id === tp.productId);
                  return (
                    <li key={tp.productId} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                      <span>
                        {p?.name ?? "…"}
                        <span className="block text-sm text-muted">{countUnits(tp.baseUnits, p?.unitName ?? "unit")}</span>
                      </span>
                      <MoneyText paisa={tp.totalPaisa} />
                    </li>
                  );
                })}
              </ol>
              {q.data.topProducts.length === 0 ? <p className="mt-2 text-ink-2">{t("noSalesInDates")}</p> : null}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
