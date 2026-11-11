"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

/** "Your session ended" when the chooser is opened with ?ended=1. */
export function EndedNote() {
  const t = useTranslations("Auth.messages");
  const ended = useSearchParams().get("ended") === "1";
  if (!ended) return null;
  return (
    <p role="status" className="stock mt-8 rounded-stock px-5 py-4 font-medium">
      {t("unauthorized")}
    </p>
  );
}
