"use client";

// What the salesman carries today: for each product, issued, sold and what should be left,
// in pieces and in cartons.

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Card } from "@/components/ui/Display";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import { cartonEquivalent, countUnits } from "@/lib/units";
import { useToday } from "./useToday";

export function StockToday() {
  const t = useTranslations("Salesman.stockToday");
  const tNav = useTranslations("Nav");
  const { plan, report } = useToday();
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const byId = useMemo(() => new Map((products.data?.items ?? []).map((p) => [p.id, p])), [products.data]);
  if (plan.isPending) return <LoadingState label={t("loading")} />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data)
    return (
      <>
        <h1 className="visually-hidden">{tNav("stock")}</h1>
        <EmptyState title={t("noStockTitle")} line={t("noStockLine")} />
      </>
    );
  if (report.isPending) return <LoadingState label={t("loading")} />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  const r = report.data;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">{tNav("stock")}</h1>
      <p className="mt-2 text-lg text-ink-2">{t("line")}</p>
      <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
        {r.stock.map((l) => {
          const p = byId.get(l.productId);
          const unit = p?.unitName ?? "unit";
          const per = p?.unitsPerCarton ?? null;
          const cells: [string, number][] = [
            [t("issued"), l.issued],
            [t("sold"), l.sold],
            [t("left"), l.remaining],
          ];
          return (
            <li key={l.productId}>
              <Card dense>
                <p className="text-lg font-medium">{p?.name ?? "…"}</p>
                <dl className="m-0 mt-3 grid grid-cols-3 gap-3">
                  {cells.map(([k, n]) => (
                    <div key={k}>
                      <dt className="text-sm text-muted">{k}</dt>
                      <dd className={`m-0 mt-0.5 font-outlier ${k === t("left") ? "text-lg font-semibold" : ""}`}>{countUnits(n, unit)}</dd>
                      {cartonEquivalent(n, per, unit) ? <dd className="m-0 text-xs text-muted">{cartonEquivalent(n, per, unit)}</dd> : null}
                    </div>
                  ))}
                </dl>
                {l.writtenOff ? <p className="mt-2 text-sm text-ink-2">{t("writtenOff", { count: l.writtenOff })}</p> : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
