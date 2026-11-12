"use client";

// Today's sales across all shops: how many, how much, the cash collected, and shop by shop.

import { useTranslations } from "next-intl";
import { Card, MoneyText } from "@/components/ui/Display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { formatDate } from "@/lib/dates";

export function TodaySales() {
  const t = useTranslations("Salesman.todaySales");
  const tShared = useTranslations("Salesman.shared");
  const q = useApiQuery(["reports", "today"], (api) => api.reports.today());
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  if (q.isPending) return <LoadingState label={t("loading")} />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const r = q.data;
  const name = (id: string) => shops.data?.items.find((s) => s.id === id)?.name ?? "…";
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-2">{formatDate(r.date)}</p>
      <dl className="m-0 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [tShared("sales"), String(r.count)],
          [tShared("total"), <MoneyText key="t" paisa={r.totalPaisa} />],
          [tShared("cashCollected"), <MoneyText key="c" paisa={r.cashCollectedPaisa} />],
        ].map(([k, v]) => (
          <Card key={k as string} dense>
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="m-0 mt-1 font-outlier text-2xl">{v}</dd>
          </Card>
        ))}
      </dl>
      <h2 className="mt-8 text-title tracking-normal">{t("byShop")}</h2>
      {r.byShop.length === 0 ? (
        <EmptyState title={t("noSalesTitle")} line={t("noSalesLine")} />
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {r.byShop.map((s) => (
            <li key={s.shopId}>
              <Card dense className="flex flex-wrap items-baseline justify-between gap-3">
                <span>
                  <span className="block text-lg font-medium">{name(s.shopId)}</span>
                  <span className="block text-sm text-muted">
                    {t("saleCount", { count: s.count })}
                    {s.cashPaisa ? (
                      <>
                        , <MoneyText paisa={s.cashPaisa} />
                        {t("inCash")}
                      </>
                    ) : null}
                  </span>
                </span>
                <MoneyText paisa={s.totalPaisa} className="text-lg" />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
