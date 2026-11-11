"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locale";

/** English/Nepali toggle, styled like the app's segmented control. */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const [pending, startTransition] = useTransition();

  return (
    <div className={`segmented ${className}`} role="group" aria-label={t("label")}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
