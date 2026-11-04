"use client";

// The day's shops in route order, each with its visit status, what it owes and what it bought
// today. Search by name or place. Add a shop that is not on the route, or a new shop.

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

export const VISIT_LABEL = { pending: "Planned", visited: "Visited", skipped: "Skipped" } as const;

export function RouteShops() {
  const { plan } = useToday();
  const id = plan.data?.id;
  const shops = useApiQuery(["dayPlans", "shops", id ?? "none"], (api) => api.dayPlans.shops(id!), { enabled: Boolean(id) });
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  if (plan.isPending) return <LoadingState label="Loading your shops" />;
  if (plan.isError) return <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />;
  if (!plan.data) return <EmptyState title="No plan for today" line="When your manager gives you a route, its shops show here in order." />;
  if (shops.isPending) return <LoadingState label="Loading your shops" />;
  if (shops.isError) return <ErrorState message={errorMessage(shops.error)} onRetry={() => shops.refetch()} />;

  const live = plan.data.status === "in_progress";
  const term = search.trim().toLowerCase();
  const list = term ? shops.data.filter((v) => [v.shop.name, v.shop.address, v.shop.ownerName].some((x) => x.toLowerCase().includes(term))) : shops.data;
  const done = shops.data.filter((v) => v.visit.status !== "pending").length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">Shops</h1>
      <p className="mt-2 text-lg text-ink-2">
        {done} of {shops.data.length} done, in route order.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="secondary" size="lg" icon={<PlusIcon className="size-5" />} disabled={!live} onClick={() => setAdding(true)}>
          Visit a shop not on the route
        </Button>
        <Link href="/app/salesman/shops/new" className={buttonClass("secondary", "lg")}>
          <PlusIcon className="size-5" />
          New shop
        </Link>
      </div>
      {!live ? <p className="mt-2 text-sm text-ink-2">{plan.data.status === "planned" ? "Start the day on Today to visit shops." : "This day is closed."}</p> : null}

      <div className="mt-6">
        <Input label="Search" type="search" placeholder="Shop, owner or place" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <EmptyState title="No shop matches" line="Try another name, or clear the search." />
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
            {v.visit.adHoc ? " · added today" : ""}
          </span>
          <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <span className="text-muted">{v.shop.balancePaisa < 0 ? "Credit " : "Owes "}</span>
              <MoneyText paisa={Math.abs(v.shop.balancePaisa)} />
            </span>
            <span>
              <span className="text-muted">Today </span>
              {v.todaySalesCount ? <MoneyText paisa={v.todayPurchasesPaisa} /> : "nothing yet"}
            </span>
          </span>
        </span>
        <StatusBadge status={v.visit.status} label={VISIT_LABEL[v.visit.status]} />
      </Card>
    </Link>
  );
}

function AddVisit({ open, onClose, planId, onList }: { open: boolean; onClose: () => void; planId: string; onList: VisitShop[] }) {
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
      title="Visit a shop not on the route"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Go back
          </Button>
          <Button
            disabled={!shopId}
            loading={add.isPending}
            loadingLabel="Adding…"
            onClick={async () => {
              setProblem(null);
              try {
                const v = await add.mutateAsync(shopId);
                close();
                toast(`${v.shop.name} added to today's shops.`);
                router.push(`/app/salesman/shops/${v.visit.id}`);
              } catch (e) {
                setProblem(errorMessage(e));
              }
            }}
          >
            Add to today
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">It goes at the end of today&apos;s list. Your route itself does not change.</p>
      {all.isPending ? (
        <LoadingState label="Loading shops" lines={2} />
      ) : all.isError ? (
        <ErrorState message={errorMessage(all.error)} onRetry={() => all.refetch()} />
      ) : (
        <Select label="Shop" value={shopId} onChange={(e) => setShopId(e.target.value)}>
          <option value="">Choose a shop</option>
          {choices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.address}
            </option>
          ))}
        </Select>
      )}
      <FormProblem message={problem} />
    </Modal>
  );
}
