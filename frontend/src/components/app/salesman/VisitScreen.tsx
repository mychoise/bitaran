"use client";

// One shop on the day: who and where, a big balance card, what it bought today and to date,
// and large buttons for what the salesman does there. Nothing can be done unless the day is in
// progress. Skipping needs a reason.

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { CameraIcon, CartIcon, ReturnIcon, WalletIcon } from "@/components/ui/icons";
import { Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { VisitShop } from "@/lib/api/types";
import { formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { countUnits, plural } from "@/lib/units";
import { useVisitLabel } from "./RouteShops";
import { DAY_AFFECTS } from "./useToday";

export function VisitScreen({ visitId }: { visitId: string }) {
  const t = useTranslations("Salesman.visitScreen");
  const tNav = useTranslations("Nav");
  const tOnVisit = useTranslations("Salesman.onVisit");
  const visitLabel = useVisitLabel();
  const q = useApiQuery(["visits", visitId], (api) => api.visits.get(visitId));
  if (q.isPending) return <LoadingState label={tOnVisit("loadingShop")} />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/salesman/shops" label={tNav("shops")} />
          <EmptyState title={tOnVisit("notFoundTitle")} line={t("notFoundLine")} action={<Link href="/app/salesman/shops" className={buttonClass("secondary", "sm")}>{tOnVisit("todaysShops")}</Link>} />
        </>
      );
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const v = q.data;
  const live = v.planStatus === "in_progress";
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/app/salesman/shops" label={tNav("shops")} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{v.visit.adHoc ? t("shopPositionAdHoc", { position: v.position }) : t("shopPosition", { position: v.position })}</p>
          <h1 className="mt-1 text-display-s">{v.shop.name}</h1>
          <p className="mt-1 text-lg text-ink-2">{v.shop.address}</p>
          <p className="mt-1 text-sm text-ink-2">
            {v.shop.ownerName} · <a href={`tel:${v.shop.phone.replace(/\s/g, "")}`} className="text-link">{v.shop.phone}</a>
          </p>
        </div>
        <StatusBadge status={v.visit.status} label={v.visit.status === "visited" && v.visit.at ? t("visitedAt", { time: formatTime(v.visit.at) }) : visitLabel[v.visit.status]} />
      </div>

      <BalanceCard v={v} />
      <Actions v={v} live={live} />
      <TodayHere v={v} />
      <ItemsTaken shopId={v.shop.id} />
    </div>
  );
}

function BalanceCard({ v }: { v: VisitShop }) {
  const t = useTranslations("Salesman.visitScreen");
  const tStatus = useTranslations("Status");
  const s = v.shop;
  const credit = s.balancePaisa < 0;
  return (
    <Card as="section" className="mt-6" aria-label={t("balanceAria")}>
      <p className="text-sm text-muted">{credit ? t("shopHasCredit") : t("shopOwes")}</p>
      <p className={`mt-1 font-outlier text-display-s leading-none ${credit ? "text-success" : ""}`}>{formatMoney(Math.abs(s.balancePaisa))}</p>
      <dl className="m-0 mt-5 grid grid-cols-2 gap-4 border-t border-rule-2 pt-4 text-sm">
        <div className="col-span-2">
          <dt className="text-muted">{tStatus("overdue")}</dt>
          <dd className={`m-0 mt-0.5 ${s.overduePaisa > 0 ? "font-medium text-warning" : ""}`}>{s.overduePaisa > 0 ? formatMoney(s.overduePaisa) : t("nothingOverdue")}</dd>
        </div>
        {s.inClearingPaisa > 0 ? (
          <div className="col-span-2">
            <dt className="text-muted">{t("inClearingDt")}</dt>
            <dd className="m-0 mt-0.5">
              <MoneyText paisa={s.inClearingPaisa} />
              {t("inClearingLine")}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}

function Actions({ v, live }: { v: VisitShop; live: boolean }) {
  const t = useTranslations("Salesman.visitScreen");
  const tStatus = useTranslations("Status");
  const tCommon = useTranslations("Ui.Common");
  const toast = useToast();
  const [skipping, setSkipping] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const update = useApiMutation((api, input: { status: "visited" | "skipped"; skipReason?: string }) => api.visits.update(v.visit.id, input), DAY_AFFECTS);
  const q = `?visit=${encodeURIComponent(v.visit.id)}`;
  const big = [
    { key: "newSale", label: t("newSale"), href: `/app/salesman/sale/new${q}`, icon: <CartIcon className="size-6" /> },
    { key: "collectPayment", label: t("collectPayment"), href: `/app/salesman/payment/new${q}`, icon: <WalletIcon className="size-6" /> },
    { key: "returnGoods", label: t("returnGoods"), href: `/app/salesman/return/new${q}`, icon: <ReturnIcon className="size-6" /> },
    { key: "takeVisitPhoto", label: t("takeVisitPhoto"), href: `/app/salesman/visit-photo${q}`, icon: <CameraIcon className="size-6" /> },
  ];
  const tile = "h-auto min-h-20 flex-col gap-1 py-3";
  return (
    <section aria-label={t("whatToDoHere")} className="mt-6">
      {!live ? (
        <p className="mb-3 rounded-input border border-rule-2 bg-paper-3 p-3 text-ink-2">
          {v.planStatus === "planned" ? t("startDayFirst") : t("dayClosedNoChange")}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {big.map((b) =>
          live ? (
            <Link key={b.key} href={b.href} className={buttonClass(b.key === "newSale" ? "primary" : "secondary", "lg", tile)}>
              {b.icon}
              {b.label}
            </Link>
          ) : (
            <Button key={b.key} variant="secondary" size="lg" className={tile} icon={b.icon} disabled>
              {b.label}
            </Button>
          ),
        )}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          disabled={!live || v.visit.status === "visited"}
          loading={update.isPending && !skipping}
          loadingLabel={tCommon("saving")}
          onClick={async () => {
            setProblem(null);
            try {
              await update.mutateAsync({ status: "visited" });
              toast(t("markedVisitedToast", { name: v.shop.name }));
            } catch (e) {
              setProblem(errorMessage(e));
            }
          }}
        >
          {v.visit.status === "visited" ? tStatus("visited") : t("markAsVisited")}
        </Button>
        <Button variant="secondary" size="lg" disabled={!live || v.visit.status !== "pending"} onClick={() => setSkipping(true)}>
          {v.visit.status === "skipped" ? t("skippedReason", { reason: v.visit.skipReason ?? "" }) : t("skipThisShop")}
        </Button>
      </div>
      <FormProblem message={problem} />
      <SkipDialog v={v} open={skipping} onClose={() => setSkipping(false)} />
    </section>
  );
}

function SkipDialog({ v, open, onClose }: { v: VisitShop; open: boolean; onClose: () => void }) {
  const t = useTranslations("Salesman.visitScreen");
  const tShared = useTranslations("Salesman.shared");
  const tCommon = useTranslations("Ui.Common");
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const skip = useApiMutation((api, skipReason: string) => api.visits.update(v.visit.id, { status: "skipped", skipReason }), DAY_AFFECTS);
  const close = () => {
    setReason("");
    setTried(false);
    setProblem(null);
    onClose();
  };
  const REASONS = [t("reasons.shopClosed"), t("reasons.ownerAway"), t("reasons.noOrderToday"), t("reasons.ranOutOfTime")];
  const error = tried && !reason.trim() ? t("sayWhySkipped") : reason.length > 200 ? tShared("keepReasonUnder200") : undefined;
  return (
    <Modal
      open={open}
      onClose={close}
      title={t("skipDialogTitle", { name: v.shop.name })}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tCommon("goBack")}
          </Button>
          <Button
            loading={skip.isPending}
            loadingLabel={t("skipping")}
            onClick={async () => {
              setTried(true);
              if (!reason.trim() || reason.length > 200) return;
              setProblem(null);
              try {
                await skip.mutateAsync(reason.trim());
                close();
                toast(t("skippedToast", { name: v.shop.name }));
              } catch (e) {
                setProblem(errorMessage(e));
              }
            }}
          >
            {t("skipShop")}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">{t("managerSeesReason")}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("commonReasons")}>
        {REASONS.map((r) => (
          <Button key={r} variant={reason === r ? "primary" : "secondary"} size="sm" aria-pressed={reason === r} onClick={() => setReason(r)}>
            {r}
          </Button>
        ))}
      </div>
      <Textarea label={t("reason")} hint={t("reasonHint")} value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      <FormProblem message={problem} />
    </Modal>
  );
}

function TodayHere({ v }: { v: VisitShop }) {
  const t = useTranslations("Salesman.visitScreen");
  const tShared = useTranslations("Salesman.shared");
  const q = useApiQuery(["sales", "list", { planId: v.planId, shopId: v.shop.id }], (api) => api.sales.list({ planId: v.planId, shopId: v.shop.id, pageSize: 50 }));
  const products = useProductMap();
  return (
    <Card as="section" dense className="mt-6" aria-labelledby="today-here">
      <h2 id="today-here" className="text-title tracking-normal">
        {t("boughtToday")}
      </h2>
      {q.isPending ? (
        <LoadingState label={t("loadingTodaySales")} lines={2} />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.items.filter((s) => s.status === "confirmed").length === 0 ? (
        <p className="mt-2 text-ink-2">{t("nothingYetToday")}</p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {q.data.items
            .filter((s) => s.status === "confirmed")
            .map((s) => (
              <li key={s.id} className="border-t border-rule-2 py-2.5">
                <p className="flex justify-between gap-3">
                  <span>{t("invoiceTimeLine", { no: s.invoiceNo, time: formatTime(s.createdAt) })}</span>
                  <MoneyText paisa={s.totalPaisa} />
                </p>
                <p className="text-sm text-muted">
                  {s.lines.map((l) => `${l.unit === "carton" ? tShared("cartonCount", { count: l.quantity }) : countUnits(l.quantity, products.get(l.productId)?.unitName ?? "unit")} ${products.get(l.productId)?.name ?? ""}`).join(", ")}
                </p>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function useProductMap() {
  const q = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  return useMemo(() => new Map((q.data?.items ?? []).map((p) => [p.id, p])), [q.data]);
}

function ItemsTaken({ shopId }: { shopId: string }) {
  const t = useTranslations("Salesman.visitScreen");
  const tShared = useTranslations("Salesman.shared");
  const q = useApiQuery(["shops", "items", shopId], (api) => api.shops.itemsTaken(shopId));
  const products = useProductMap();
  return (
    <Card as="section" dense className="mt-6" aria-labelledby="taken-title">
      <h2 id="taken-title" className="text-title tracking-normal">
        {t("takenToDate")}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{t("whatShopBuys")}</p>
      {q.isPending ? (
        <LoadingState label={t("loading")} lines={3} />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <p className="mt-2 text-ink-2">{t("firstOrder")}</p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {q.data.map((i) => {
            const p = products.get(i.productId);
            return (
              <li key={`${i.productId}-${i.unit}`} className="flex justify-between gap-3 border-t border-rule-2 py-2">
                <span className="min-w-0">{p?.name ?? "…"}</span>
                <span className="shrink-0 font-outlier text-sm">
                  {i.unit === "carton" ? tShared("cartonCount", { count: i.quantity }) : `${i.quantity} ${i.quantity === 1 ? (p?.unitName ?? "unit") : plural(p?.unitName ?? "unit")}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
