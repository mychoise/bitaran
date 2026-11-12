"use client";

// Shared by the screens that act on one shop visit (sale, payment, return, photo): the visit
// from ?visit=…, a guard for when it cannot be acted on, and one idempotency key per attempt.

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/Form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiQuery } from "@/lib/api/provider";
import type { VisitShop } from "@/lib/api/types";

/** A fresh key for one attempt at a submit. Repeating that attempt reuses it. */
export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** One key until `renew` (after a success), so a double tap or a retry sends the same key. */
export function useOnceKey() {
  const [key, setKey] = useState(newKey);
  const renew = useCallback(() => setKey(newKey()), []);
  return { key, renew };
}

/**
 * Double-tap protection on the screen: while one submit is running, another tap does nothing.
 * (The idempotency key is the second guard, on the server.)
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(async (run: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await run();
    } finally {
      busy.current = false;
    }
  }, []);
}

export function VisitGate({ title, children }: { title: string; children: (v: VisitShop) => ReactNode }) {
  const t = useTranslations("Salesman.onVisit");
  const tNav = useTranslations("Nav");
  const params = useSearchParams();
  const id = params.get("visit") ?? "";
  const q = useApiQuery(["visits", id], (api) => api.visits.get(id), { enabled: Boolean(id) });
  const back = (href: string, label: string) => <BackLink href={href} label={label} />;
  if (!id)
    return (
      <>
        {back("/app/salesman/shops", tNav("shops"))}
        <EmptyState title={t("chooseShopFirst", { title })} line={t("openShopFirst")} action={<Link href="/app/salesman/shops" className={buttonClass("secondary", "sm")}>{t("todaysShops")}</Link>} />
      </>
    );
  if (q.isPending) return <LoadingState label={t("loadingShop")} />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found") return <EmptyState title={t("notFoundTitle")} line={t("notFoundLine")} action={<Link href="/app/salesman/shops" className={buttonClass("secondary", "sm")}>{t("todaysShops")}</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const v = q.data;
  return (
    <div className="mx-auto max-w-3xl">
      {back(`/app/salesman/shops/${v.visit.id}`, v.shop.name)}
      {/* On paper only the invoice shows, with its own header. */}
      <div className="no-print">
        <h1 className="text-display-s">{title}</h1>
        <p className="mt-1 text-lg text-ink-2">
          {v.shop.name}, {v.shop.address}
        </p>
      </div>
      {v.planStatus !== "in_progress" ? (
        <p className="mt-6 rounded-input border border-rule-2 bg-paper-3 p-4 text-ink-2">
          {v.planStatus === "planned" ? t("notStarted") : t("dayClosed")}
        </p>
      ) : (
        <div className="mt-6">{children(v)}</div>
      )}
    </div>
  );
}
