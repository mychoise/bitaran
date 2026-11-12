"use client";

// The salesman's Today. Planned: the route, its shops and the stock, with a big Start day.
// In progress: how far along, today's sales and cash, the next shop, and Close day.
// Closed: a read-only summary. No plan: says so plainly.

import { useTranslations } from "next-intl";
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
  const t = useTranslations("Salesman.today");
  const tNav = useTranslations("Nav");
  const { plan, report } = useToday();
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  if (plan.isPending) return <LoadingState label={t("loading")} />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data)
    return (
      <>
        <h1 className="visually-hidden">{tNav("today")}</h1>
        <EmptyState title={t("noPlanTitle")} line={t("noPlanLine")} />
      </>
    );
  if (report.isPending) return <LoadingState label={t("loading")} />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  const route = routes.data?.find((r) => r.id === plan.data!.routeId);
  const r = report.data;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-ink-2">{formatDate(r.plan.date)}</p>
      <h1 className="mt-1 text-display-s">{route?.name ?? t("defaultRouteName")}</h1>
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
  const t = useTranslations("Salesman.today");
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const p = (id: string) => products.data?.items.find((x) => x.id === id);
  return (
    <Card as="section" dense aria-labelledby="carry-title">
      <h2 id="carry-title" className="text-title tracking-normal">
        {t("stockTitle")}
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
  const t = useTranslations("Salesman.today");
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const start = useApiMutation((api) => api.dayPlans.start(r.plan.id), DAY_AFFECTS);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg">{t("shopsToVisit", { count: r.plan.visits.length })}</p>
      <StockSummary report={r} />
      <div>
        <Button
          size="lg"
          className="w-full"
          loading={start.isPending}
          loadingLabel={t("starting")}
          onClick={async () => {
            setProblem(null);
            try {
              await start.mutateAsync(undefined);
              toast(t("dayStartedToast"));
            } catch (e) {
              setProblem(errorMessage(e));
            }
          }}
        >
          {t("startDay")}
        </Button>
        <FormProblem message={problem} />
      </div>
    </div>
  );
}

function InProgress({ report: r }: { report: DayReport }) {
  const t = useTranslations("Salesman.today");
  const tShared = useTranslations("Salesman.shared");
  const shops = useApiQuery(["dayPlans", "shops", r.plan.id], (api) => api.dayPlans.shops(r.plan.id));
  const done = r.visits.visited + r.visits.skipped;
  const total = done + r.visits.pending;
  const next = shops.data?.find((v) => v.visit.status === "pending");
  return (
    <div className="flex flex-col gap-6">
      <Card as="section" dense aria-label={t("howFarAlong")}>
        <p className="text-lg">
          <span className="font-outlier text-2xl">{done}</span> {t("ofShopsDone", { total })}
        </p>
        <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-3 block h-2 w-full" aria-hidden>
          <rect width="100" height="6" rx="3" className="fill-paper-3" />
          <rect width={total ? (done / total) * 100 : 0} height="6" rx="3" className="fill-accent-2" />
        </svg>
        <dl className="m-0 mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">{tShared("sales")}</dt>
            <dd className="m-0 mt-1 text-xl">
              <MoneyText paisa={r.sales.totalPaisa} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{tShared("cashCollected")}</dt>
            <dd className="m-0 mt-1 text-xl">
              <MoneyText paisa={r.cash.collectedPaisa} />
            </dd>
          </div>
        </dl>
      </Card>
      {next ? (
        <Card as="section" dense aria-label={t("nextShop")}>
          <p className="text-sm text-muted">{t("nextShop")}</p>
          <p className="mt-1 text-title font-semibold">{next.shop.name}</p>
          <p className="text-ink-2">{next.shop.address}</p>
          <Link href={`/app/salesman/shops/${next.visit.id}`} className={buttonClass("primary", "lg", "mt-4 w-full")}>
            {t("openShop", { name: next.shop.name })}
          </Link>
        </Card>
      ) : shops.data ? (
        <p className="text-lg">{t("everyShopDone")}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/app/salesman/shops" className={buttonClass("secondary", "lg", "w-full")}>
          {t("allShops")}
        </Link>
        <Link href="/app/salesman/close-day" className={buttonClass("secondary", "lg", "w-full")}>
          {t("closeDayLink")}
        </Link>
      </div>
    </div>
  );
}

function Closed({ report: r }: { report: DayReport }) {
  const t = useTranslations("Salesman.today");
  const tShared = useTranslations("Salesman.shared");
  const tNav = useTranslations("Nav");
  return (
    <Card as="section" aria-label={t("yourDay")}>
      <p className="text-lg">
        {r.plan.closedAt ? t("dayClosedAt", { time: formatTime(r.plan.closedAt) }) : t("dayClosed")} {r.plan.status === "reconciled" ? t("mgrCounted") : t("mgrWillCount")}
      </p>
      <dl className="m-0 mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-muted">{tNav("shops")}</dt>
          <dd className="m-0 mt-1">{tShared("shopsVisitedSkipped", { visited: r.visits.visited, skipped: r.visits.skipped })}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{tShared("sales")}</dt>
          <dd className="m-0 mt-1">
            <MoneyText paisa={r.sales.totalPaisa} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{tShared("cashCollected")}</dt>
          <dd className="m-0 mt-1">
            <MoneyText paisa={r.cash.collectedPaisa} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{tShared("cashHandedOver")}</dt>
          <dd className="m-0 mt-1">{r.cash.handedOverPaisa === null ? tShared("notGiven") : <MoneyText paisa={r.cash.handedOverPaisa} />}</dd>
        </div>
      </dl>
      <Link href="/app/salesman/close-day" className={buttonClass("secondary", "md", "mt-6")}>
        {t("seeHandedBack")}
      </Link>
    </Card>
  );
}
