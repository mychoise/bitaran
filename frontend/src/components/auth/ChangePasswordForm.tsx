"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { changePassword, type ChangePasswordState } from "@/app/app/change-password/actions";
import { PasswordField } from "./PasswordField";

type Field = "currentPassword" | "newPassword" | "confirmPassword";

/** Current, new and confirm. Checked here first, then by the Server Function. */
export function ChangePasswordForm({ backHref }: { backHref: string }) {
  const t = useTranslations("Auth.changePassword");
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, { status: "idle" });
  const [localErrors, setLocalErrors] = useState<Partial<Record<Field, string>>>({});
  const resultRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "ended") {
      router.replace(`${state.loginPath}?ended=1`);
      return;
    }
    if (state.status === "ok" || state.status === "error") resultRef.current?.focus();
  }, [state, router]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const current = String(data.get("currentPassword") ?? "");
    const next = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const errors: Partial<Record<Field, string>> = {};
    if (!current) errors.currentPassword = t("enterCurrent");
    if (next.length < 8) errors.newPassword = t("minLength", { min: 8 });
    else if (next === current) errors.newPassword = t("sameAsCurrent");
    if (!confirm) errors.confirmPassword = t("confirmRequired");
    else if (next && confirm !== next) errors.confirmPassword = t("mismatch");
    setLocalErrors(errors);
    const first = (["currentPassword", "newPassword", "confirmPassword"] as Field[]).find((f) => errors[f]);
    if (first) {
      e.preventDefault();
      e.currentTarget.querySelector<HTMLInputElement>(`#${first}`)?.focus();
    }
  }

  const serverField = state.status === "error" ? state.field : undefined;
  const errorFor = (f: Field) => localErrors[f] ?? (serverField === f && state.status === "error" ? state.message : undefined);

  return (
    <div className="max-w-xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <p className="lead mt-4 text-ink-2">{t("subtitle")}</p>

      <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="mt-8 outline-none">
        {state.status === "ok" ? (
          <p className="stock rounded-stock px-5 py-4 font-medium">{t("success")}</p>
        ) : null}
        {state.status === "error" && !state.field ? (
          <p className="rounded-stock border-2 border-error px-5 py-4 font-medium">{state.message}</p>
        ) : null}
      </div>

      <form noValidate action={action} onSubmit={onSubmit} className="mt-6 flex flex-col gap-2" aria-busy={pending || undefined}>
        <PasswordField id="currentPassword" label={t("currentLabel")} autoComplete="current-password" error={errorFor("currentPassword")} disabled={pending} autoFocus />
        <PasswordField id="newPassword" label={t("newLabel")} autoComplete="new-password" hint={t("newHint")} error={errorFor("newPassword")} disabled={pending} />
        <PasswordField id="confirmPassword" label={t("confirmLabel")} autoComplete="new-password" error={errorFor("confirmPassword")} disabled={pending} />
        <button type="submit" className="btn btn-ink mt-4" disabled={pending}>
          {pending ? t("saving") : t("submit")}
        </button>
      </form>

      <p className="mt-8">
        <Link href={backHref} className="text-link">
          {t("backToPage")}
        </Link>
      </p>
    </div>
  );
}
