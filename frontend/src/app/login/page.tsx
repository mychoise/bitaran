import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { EndedNote } from "@/components/auth/EndedNote";
import { ArrowRightIcon } from "@/components/ui/icons";
import { config } from "@/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return { title: t("signIn") };
}

/** The chooser: staff and shops sign in on separate forms. */
export default async function LoginChooserPage() {
  const t = await getTranslations("LoginPage");
  const choices = [
    { href: "/login/staff", title: t("staffChoiceTitle"), line: t("staffChoiceLine") },
    { href: "/login/shop", title: t("shopChoiceTitle"), line: t("shopChoiceLine") },
  ];
  return (
    <AuthShell>
      <div>
        <h1 className="text-display-s">{t("title")}</h1>
        <p className="lead mt-4 text-ink-2">{t("subtitle")}</p>
        <Suspense fallback={null}>
          <EndedNote />
        </Suspense>
        <ul className="m-0 mt-10 flex list-none flex-col gap-5 p-0">
          {choices.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="choice stock flex items-center justify-between gap-6 rounded-stock p-7 no-underline">
                <span>
                  <span className="block text-title font-semibold">{c.title}</span>
                  <span className="mt-2 block text-ink-2">{c.line}</span>
                </span>
                <ArrowRightIcon className="choice-arrow size-6 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 border-t border-rule-2 pt-6">
          <h2 className="text-title tracking-normal">{t("noAccountTitle")}</h2>
          <p className="mt-2 text-ink-2">{t("noAccountLine")}</p>
          <p className="mt-3 text-ink-2">
            {t("ownBusiness")}{" "}
            <Link href={config.demoUrl} className="text-link whitespace-nowrap">
              {t("requestDemo")}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
