"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EMAIL_PATTERN, messageFor, SESSION_ENDED } from "./messages";
import { PasswordField } from "./PasswordField";

type Kind = "staff" | "shop";

const COPY: Record<Kind, { title: string; who: string; forgot: string; switchAsk: string; switchText: string; switchHref: string }> = {
  staff: {
    title: "Sign in to work",
    who: "For owners, managers and salesmen.",
    forgot: "Forgot your password? Ask your manager or the business owner to reset it.",
    switchAsk: "Are you a shop?",
    switchText: "Shop sign in",
    switchHref: "/login/shop",
  },
  shop: {
    title: "Sign in as a shop",
    who: "See your balance and statement.",
    forgot: "Forgot your password? Ask your wholesaler to reset it.",
    switchAsk: "Do you work for the wholesaler?",
    switchText: "Staff sign in",
    switchHref: "/login/staff",
  },
};

type FieldErrors = { email?: string; password?: string };

/**
 * Email and password, posted as JSON to this site's own route handler. The handler sets an
 * httpOnly cookie; nothing is kept in localStorage, sessionStorage or the URL.
 */
export function LoginForm({ kind, ended = false }: { kind: Kind; ended?: boolean }) {
  const copy = COPY[kind];
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  // The first field gets focus once the form is live (autoFocus alone is skipped on hydration).
  useEffect(() => emailRef.current?.focus(), []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return; // a second click while sending does nothing
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const errors: FieldErrors = {};
    if (!email) errors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "That email looks incomplete. Write it as name@example.com.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) {
      form.querySelector<HTMLInputElement>(errors.email ? "#email" : "#password")?.focus();
      return;
    }

    inFlight.current = true;
    setSending(true);
    try {
      const res = await fetch(`/api/auth/${kind}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; redirectTo?: string; error?: string } | null;
      if (res.ok && body?.ok && body.redirectTo?.startsWith("/app/")) {
        // The new cookie goes with the next request. The button stays disabled while it loads.
        router.replace(body.redirectTo);
        return;
      }
      setFormError(messageFor(body?.error));
    } catch {
      setFormError(messageFor("unreachable"));
    }
    inFlight.current = false;
    setSending(false);
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  return (
    <div>
      <h1 className="text-display-s">{copy.title}</h1>
      <p className="lead mt-4 text-ink-2">{copy.who}</p>

      {ended && !formError ? (
        <p role="status" className="stock mt-8 rounded-stock px-5 py-4 font-medium">
          {SESSION_ENDED}
        </p>
      ) : null}

      <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-2" aria-busy={sending || undefined}>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="font-medium">
            Email
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            disabled={sending}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby="email-note"
            className="field h-12 rounded-input border border-muted bg-cotton px-4 text-md text-ink"
          />
          <p id="email-note" role={fieldErrors.email ? "alert" : undefined} className="min-h-5 text-sm font-medium text-error">
            {fieldErrors.email ?? ""}
          </p>
        </div>

        <PasswordField id="password" label="Password" autoComplete="current-password" error={fieldErrors.password} disabled={sending} />

        <div ref={alertRef} tabIndex={-1} role="alert" aria-live="assertive" className="outline-none">
          {formError ? <p className="rounded-stock border-2 border-error px-5 py-4 font-medium">{formError}</p> : null}
        </div>

        <button type="submit" className="btn btn-ink mt-4 w-full" disabled={sending}>
          {sending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-ink-2">{copy.forgot}</p>
      <p className="mt-4">
        {copy.switchAsk}{" "}
        <Link href={copy.switchHref} className="text-link whitespace-nowrap">
          {copy.switchText}
        </Link>
      </p>
    </div>
  );
}

/** Reads ?ended=1 (set when a session ran out) inside a Suspense boundary. */
export function LoginFormFromQuery({ kind }: { kind: Kind }) {
  const params = useSearchParams();
  return <LoginForm kind={kind} ended={params.get("ended") === "1"} />;
}
