"use client";

// The day's shops in route order, each with its visit status, what it owes and what it bought
// today. Search by name or place. Add a shop that is not on the route, or a new shop.

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { PlusIcon } from "@/components/ui/icons";
import { Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { VisitShop } from "@/lib/api/types";
import { DAY_AFFECTS, useToday } from "./useToday";

/** Same words as the day-plan Status namespace: "pending" for a visit means "Planned". */
export function useVisitLabel() {
  const t = useTranslations("Status");
  return { pending: t("planned"), visited: t("visited"), skipped: t("skipped") } as const;
}

export function RouteShops() {
  const t = useTranslations("Salesman.routeShops");
  const tNav = useTranslations("Nav");
  const tShared = useTranslations("Salesman.shared");
  const tToday = useTranslations("Salesman.today");
  const tNewShop = useTranslations("Salesman.newShop");
  const { plan } = useToday();
  const id = plan.data?.id;
  const shops = useApiQuery(["dayPlans", "shops", id ?? "none"], (api) => api.dayPlans.shops(id!), { enabled: Boolean(id) });
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  if (plan.isPending) return <LoadingState label={t("loadingShops")} />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data)
    return (
      <>
        <h1 className="visually-hidden">{tNav("shops")}</h1>
        <EmptyState title={tToday("noPlanTitle")} line={t("noPlanLine")} />
      </>
    );
  if (shops.isPending) return <LoadingState label={t("loadingShops")} />;
  if (shops.isError) return <ErrorState message={errorMessage(shops.error)} onRetry={() => shops.refetch()} />;

  const live = plan.data.status === "in_progress";
  const term = search.trim().toLowerCase();
  const list = term ? shops.data.filter((v) => [v.shop.name, v.shop.address, v.shop.ownerName].some((x) => x.toLowerCase().includes(term))) : shops.data;
  const done = shops.data.filter((v) => v.visit.status !== "pending").length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">{tNav("shops")}</h1>
      <p className="mt-2 text-lg text-ink-2">{t("doneInOrder", { done, total: shops.data.length })}</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="secondary" size="lg" icon={<PlusIcon className="size-5" />} disabled={!live} onClick={() => setAdding(true)}>
          {t("visitNotOnRoute")}
        </Button>
        <Link href="/app/salesman/shops/new" className={buttonClass("secondary", "lg")}>
          <PlusIcon className="size-5" />
          {tNewShop("title")}
        </Link>
      </div>
      {!live ? <p className="mt-2 text-sm text-ink-2">{plan.data.status === "planned" ? t("startDayToVisit") : tShared("dayClosedNote")}</p> : null}

      <div className="mt-6">
        <Input label={t("search")} type="search" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <EmptyState title={t("noShopMatch")} line={t("noShopMatchLine")} />
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {list.map((v) => (
            <li key={v.visit.id}>
              <ShopCard v={v} />
            </li>
          ))}
        </ol>
      )}
      <AddVisit open={adding} onClose={() => setAdding(false)} planId={plan.data.id} onList={shops.data} />
    </div>
  );
}

function ShopCard({ v }: { v: VisitShop }) {
  const t = useTranslations("Salesman.routeShops");
  const visitLabel = useVisitLabel();
  return (
    <Link href={`/app/salesman/shops/${v.visit.id}`} className="block rounded-stock no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <Card dense className="flex items-start gap-4">
        <span className="w-6 pt-0.5 text-right font-outlier text-lg text-muted" aria-hidden>
          {v.position}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium text-ink">{v.shop.name}</span>
          <span className="block text-sm text-muted">
            {v.shop.address}
            {v.visit.adHoc ? t("addedToday") : ""}
          </span>
          <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <span className="text-muted">{v.shop.balancePaisa < 0 ? t("creditPrefix") : t("owesPrefix")}</span>
              <MoneyText paisa={Math.abs(v.shop.balancePaisa)} />
            </span>
            <span>
              <span className="text-muted">{t("todayPrefix")}</span>
              {v.todaySalesCount ? <MoneyText paisa={v.todayPurchasesPaisa} /> : t("nothingYet")}
            </span>
          </span>
        </span>
        <StatusBadge status={v.visit.status} label={visitLabel[v.visit.status]} />
      </Card>
    </Link>
  );
}

function AddVisit({ open, onClose, planId, onList }: { open: boolean; onClose: () => void; planId: string; onList: VisitShop[] }) {
  const t = useTranslations("Salesman.routeShops");
  const tShared = useTranslations("Salesman.shared");
  const tCommon = useTranslations("Ui.Common");
  const router = useRouter();
  const toast = useToast();
  const all = useApiQuery(["shops", "list", "active"], (api) => api.shops.list({ pageSize: 200, active: true }), { enabled: open });
  const [shopId, setShopId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const add = useApiMutation((api, sid: string) => api.dayPlans.addVisit(planId, sid), DAY_AFFECTS);
  const choices = (all.data?.items ?? []).filter((s) => !onList.some((v) => v.shop.id === s.id));
  const close = () => {
    setShopId("");
    setProblem(null);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={t("visitNotOnRoute")}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tCommon("goBack")}
          </Button>
          <Button
            disabled={!shopId}
            loading={add.isPending}
            loadingLabel={t("adding")}
            onClick={async () => {
              setProblem(null);
              try {
                const v = await add.mutateAsync(shopId);
                close();
                toast(t("addedToast", { name: v.shop.name }));
                router.push(`/app/salesman/shops/${v.visit.id}`);
              } catch (e) {
                setProblem(errorMessage(e));
              }
            }}
          >
            {t("addToToday")}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">{t("addedAtEnd")}</p>
      {all.isPending ? (
        <LoadingState label={t("loadingShopsList")} lines={2} />
      ) : all.isError ? (
        <ErrorState message={errorMessage(all.error)} onRetry={() => all.refetch()} />
      ) : (
        <Select label={t("shopFieldLabel")} value={shopId} onChange={(e) => setShopId(e.target.value)}>
          <option value="">{tShared("chooseShop")}</option>
          {choices.map((s) => (
            <option key={s.id} value={s.id}>
              {t("shopOption", { name: s.name, address: s.address })}
            </option>
          ))}
        </Select>
      )}
      <FormProblem message={problem} />
    </Modal>
  );
}
