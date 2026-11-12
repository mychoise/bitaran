"use client";

// Closing the day, one stage at a time: every shop visited or skipped, then the stock left (worked
// out from what was issued, sold and written off; never typed), then the cash handed over, then a
// review and a confirm. Once closed, a read-only
// summary of what was handed back.

import { useTranslations } from "next-intl";
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

export function CloseDay() {
  const t = useTranslations("Salesman.closeDay");
  const tToday = useTranslations("Salesman.today");
  const tNav = useTranslations("Nav");
  const { plan, report } = useToday();
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const byId = useMemo(() => new Map((products.data?.items ?? []).map((p) => [p.id, p])), [products.data]);
  if (plan.isPending) return <LoadingState label={t("loading")} />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data)
    return (
      <>
        <h1 className="visually-hidden">{t("title")}</h1>
        <EmptyState title={tToday("noPlanTitle")} line={t("noPlanLine")} />
      </>
    );
  if (report.isPending || products.isPending) return <LoadingState label={t("loading")} />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  const r = report.data;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">{t("title")}</h1>
      {r.plan.status === "planned" ? (
        <EmptyState title={t("notStartedTitle")} line={t("notStartedLine")} action={<Link href="/app/salesman" className={buttonClass("secondary", "sm")}>{tNav("today")}</Link>} />
      ) : r.plan.status === "in_progress" ? (
        <Wizard report={r} product={(id) => byId.get(id)} />
      ) : (
        <ClosedSummary report={r} product={(id) => byId.get(id)} />
      )}
    </div>
  );
}

function Wizard({ report: r, product }: { report: DayReport; product: (id: string) => Product | undefined }) {
  const t = useTranslations("Salesman.closeDay");
  const tShared = useTranslations("Salesman.shared");
  const tRouteShops = useTranslations("Salesman.routeShops");
  const STAGES = [t("stages.shops"), t("stages.stockLeft"), t("stages.cash"), t("stages.review")];
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
      toast(t("closedToast"));
    } catch (e) {
      setConfirming(false);
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <ol className="m-0 mt-6 flex list-none items-start justify-between p-0" aria-label={t("stagesAria")}>
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
            <LoadingState label={tRouteShops("loadingShops")} lines={3} />
          ) : shops.isError ? (
            <ErrorState message={errorMessage(shops.error)} onRetry={() => shops.refetch()} />
          ) : pending.length ? (
            <>
              <h2 className="text-title tracking-normal">{t("shopsLeftTitle", { count: pending.length })}</h2>
              <p className="mt-1 text-ink-2">{t("shopsLeftLine")}</p>
              <ul className="m-0 mt-4 list-none p-0">
                {pending.map((v) => (
                  <li key={v.visit.id} className="flex items-center justify-between gap-3 border-t border-rule-2 py-3">
                    <span>
                      <span className="block font-medium">{v.shop.name}</span>
                      <span className="block text-sm text-muted">{v.shop.address}</span>
                    </span>
                    <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("secondary", "sm")}>
                      {t("openButton")}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-title tracking-normal">{t("everyShopDoneTitle")}</h2>
              <p className="mt-1 text-ink-2">{tShared("shopsVisitedSkipped", { visited: r.visits.visited, skipped: r.visits.skipped })}</p>
            </>
          )
        ) : stage === 1 ? (
          <>
            <h2 className="text-title tracking-normal">{t("stockLeftTitle")}</h2>
            <p className="mt-1 text-ink-2">{t("stockLeftLine")}</p>
            <div className="table-scroll mt-4">
              <table className="data-table">
                <caption className="visually-hidden">{t("stockCaption")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("product")}</th>
                    <th scope="col" className="num">{t("issued")}</th>
                    <th scope="col" className="num">{t("sold")}</th>
                    {r.stock.some((l) => l.writtenOff) ? <th scope="col" className="num">{t("writtenOff")}</th> : null}
                    <th scope="col" className="num">{t("left")}</th>
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
                        {r.stock.some((x) => x.writtenOff) ? <td className="num">{l.writtenOff ? countUnits(l.writtenOff, unit) : t("none")}</td> : null}
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
            <h2 className="text-title tracking-normal">{t("cashTitle")}</h2>
            <p className="mt-1 text-ink-2">{t("cashLine", { amount: formatMoney(r.cash.collectedPaisa) })}</p>
            <div className="mt-4 max-w-xs">
              <Input label={t("cashHandedOverLabel")} inputMode="decimal" size="lg" autoComplete="off" value={cash} error={cashPaisa === null ? t("cashEnterError") : undefined} onChange={(e) => setCash(e.target.value)} />
            </div>
            {cashPaisa !== null && cashPaisa !== r.cash.collectedPaisa ? (
              <p className="text-sm font-medium text-error">
                {cashPaisa < r.cash.collectedPaisa ? t("cashLess", { amount: formatAmount(r.cash.collectedPaisa - cashPaisa) }) : t("cashMore", { amount: formatAmount(cashPaisa - r.cash.collectedPaisa) })}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-title tracking-normal">{t("reviewTitle")}</h2>
            <dl className="m-0 mt-4 flex flex-col gap-2">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">{t("shops")}</dt>
                <dd className="m-0 text-right">{tShared("shopsVisitedSkipped", { visited: r.visits.visited, skipped: r.visits.skipped })}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">{t("sales")}</dt>
                <dd className="m-0 text-right">
                  {r.sales.count}, <MoneyText paisa={r.sales.totalPaisa} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">{tShared("cashHandedOver")}</dt>
                <dd className="m-0 text-right">{cashPaisa === null ? "" : <MoneyText paisa={cashPaisa} />}</dd>
              </div>
            </dl>
            <h3 className="mt-5 text-sm font-semibold tracking-wide text-muted uppercase">{t("stockHandBackTitle")}</h3>
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
          {t("back")}
        </Button>
        {stage < STAGES.length - 1 ? (
          <Button size="lg" disabled={!canGo[stage]} onClick={() => setStage(stage + 1)}>
            {t("next")}
          </Button>
        ) : (
          <Button size="lg" onClick={() => setConfirming(true)}>
            {t("closeMyDay")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onClose}
        busy={close.isPending}
        title={t("closeDialogTitle")}
        consequence={t("closeConsequence", { cash: cashPaisa === null ? t("theCash") : formatMoney(cashPaisa) })}
        confirmLabel={t("closeDayButton")}
      />
    </>
  );
}

function ClosedSummary({ report: r, product }: { report: DayReport; product: (id: string) => Product | undefined }) {
  const t = useTranslations("Salesman.closeDay");
  const tShared = useTranslations("Salesman.shared");
  return (
    <Card as="section" className="mt-6" aria-label={t("handedBackAria")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg">{r.plan.closedAt ? t("closedAt", { time: formatTime(r.plan.closedAt) }) : t("closed")}</p>
        <StatusBadge status={r.plan.status} />
      </div>
      <dl className="m-0 mt-4 flex flex-col gap-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">{tShared("cashCollected")}</dt>
          <dd className="m-0">
            <MoneyText paisa={r.cash.collectedPaisa} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">{tShared("cashHandedOver")}</dt>
          <dd className="m-0">{r.cash.handedOverPaisa === null ? tShared("notGiven") : <MoneyText paisa={r.cash.handedOverPaisa} />}</dd>
        </div>
      </dl>
      <h2 className="mt-5 text-sm font-semibold tracking-wide text-muted uppercase">{t("stockHandedBackTitle")}</h2>
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
      <p className="mt-4 text-sm text-muted">{r.plan.status === "reconciled" ? t("mgrCountedDay") : t("mgrWillCountNext")}</p>
    </Card>
  );
}
