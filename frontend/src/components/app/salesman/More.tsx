"use client";

// More: the salesman's other screens.

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card } from "@/components/ui/Display";
import { ChartIcon, ReceiptIcon, WalletIcon } from "@/components/ui/icons";

export function More() {
  const t = useTranslations("Salesman.more");
  const tHistory = useTranslations("Salesman.history");
  const tAnalytics = useTranslations("Salesman.analytics");
  const tExpenses = useTranslations("Salesman.expenses");
  const LINKS = [
    { href: "/app/salesman/history", title: tHistory("title"), line: t("historyLine"), icon: <ReceiptIcon className="size-6" /> },
    { href: "/app/salesman/analytics", title: tAnalytics("title"), line: t("analyticsLine"), icon: <ChartIcon className="size-6" /> },
    { href: "/app/salesman/expenses", title: tExpenses("title"), line: t("expensesLine"), icon: <WalletIcon className="size-6" /> },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block rounded-stock no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <Card dense className="flex items-center gap-4">
                <span className="text-ink-2" aria-hidden>
                  {l.icon}
                </span>
                <span>
                  <span className="block text-lg font-medium text-ink">{l.title}</span>
                  <span className="block text-sm text-ink-2">{l.line}</span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
