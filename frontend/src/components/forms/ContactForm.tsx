"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { config, whatsappHref } from "@/config";
import { TextAreaField, TextField } from "./fields";

type Initial = { salesmen?: string; shops?: string; phone?: string; message?: string };
type Errors = Partial<Record<"name" | "business" | "phone" | "email" | "salesmen" | "shops" | "message", string>>;
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error" }
  | { kind: "fallback"; text: string; subject: string };

const ORDER: (keyof Errors)[] = ["name", "business", "phone", "email", "salesmen", "shops", "message"];

function validate(data: FormData): Errors {
  const get = (k: string) => String(data.get(k) ?? "").trim();
  const errors: Errors = {};
  if (get("name").length < 2) errors.name = "Enter your name.";
  if (!get("business")) errors.business = "Enter your business name.";
  const digits = get("phone").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) errors.phone = "Enter a phone number we can call, such as 98XXXXXXXX.";
  const email = get("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "That email looks incomplete. Write it as name@example.com.";
  for (const k of ["salesmen", "shops"] as const) {
    const v = get(k);
    if (v && !/^\d{1,5}$/.test(v)) errors[k] = "Enter a whole number, such as 6.";
  }
  if (get("message").length > 2000) errors.message = "Keep the message under 2,000 characters.";
  return errors;
}

function compose(data: FormData) {
  const get = (k: string) => String(data.get(k) ?? "").trim();
  const lines = [
    `Name: ${get("name")}`,
    `Business: ${get("business")}`,
    `Phone: ${get("phone")}`,
    get("email") ? `Email: ${get("email")}` : "",
    get("salesmen") ? `Salesmen: ${get("salesmen")}` : "",
    get("shops") ? `Shops: ${get("shops")}` : "",
    get("message") ? `\n${get("message")}` : "",
  ].filter(Boolean);
  return { subject: `Demo request from ${get("business")}`, text: lines.join("\n") };
}

export function ContactForm({ initial = {} }: { initial?: Initial }) {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const statusRef = useRef<HTMLDivElement>(null);

  const show = (s: Status) => {
    setStatus(s);
    // Move focus to the result so keyboard and screen-reader users hear it.
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot: people never see this field, so anything in it came from a bot. Send nothing.
    if (String(data.get("website") ?? "") !== "") return;

    const found = validate(data);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      form.querySelector<HTMLElement>(`#${first}`)?.focus();
      return;
    }

    if (!config.contactEndpoint) {
      show({ kind: "fallback", ...compose(data) });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      data.delete("website");
      const res = await fetch(config.contactEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
      show(res.ok ? { kind: "sent" } : { kind: "error" });
      if (res.ok) form.reset();
    } catch {
      show({ kind: "error" });
    }
  }

  const sending = status.kind === "sending";

  return (
    <div>
      <form noValidate onSubmit={onSubmit} className="stock rounded-stock p-8 lg:p-10" aria-describedby="form-required">
        <p id="form-required" className="text-sm text-muted">
          Name, business and phone are needed.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <TextField id="name" label="Your name" autoComplete="name" required error={errors.name} />
          <TextField id="business" label="Business name" autoComplete="organization" required error={errors.business} />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={initial.phone}
            error={errors.phone}
          />
          <TextField id="email" label="Email" type="email" autoComplete="email" hint="Optional" error={errors.email} />
          <TextField
            id="salesmen"
            label="Number of salesmen"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={initial.salesmen}
            error={errors.salesmen}
          />
          <TextField
            id="shops"
            label="Number of shops"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={initial.shops}
            error={errors.shops}
          />
        </div>
        <TextAreaField
          id="message"
          label="Message"
          hint="Optional"
          defaultValue={initial.message}
          error={errors.message}
        />
        {/* Honeypot, hidden from people and from assistive technology. */}
        <div className="visually-hidden" aria-hidden="true">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-ink mt-4" disabled={sending} aria-busy={sending || undefined}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="mt-6 outline-none">
        {status.kind === "sent" ? (
          <div className="stock rounded-stock p-6">
            <p className="font-semibold">Thank you. Your message reached us.</p>
            <p className="mt-1 text-ink-2">We will get back to you by phone.</p>
          </div>
        ) : null}
        {status.kind === "error" ? (
          <div className="rounded-stock border-2 border-error p-6">
            <p className="font-semibold">Your message did not go through.</p>
            <p className="mt-1 text-ink-2">Check your connection and try again. Your details are still in the form.</p>
          </div>
        ) : null}
        {status.kind === "fallback" ? <Fallback subject={status.subject} text={status.text} /> : null}
      </div>
    </div>
  );
}

/** No endpoint yet: say so plainly and hand the message to email or WhatsApp. */
function Fallback({ subject, text }: { subject: string; text: string }) {
  const mail = config.salesEmail
    ? `mailto:${config.salesEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    : null;
  const wa = whatsappHref(text);
  return (
    <div className="rounded-stock border-2 border-ink p-6">
      <p className="font-semibold">Nothing has been sent yet.</p>
      <p className="mt-1 text-ink-2">
        This form is not connected to our inbox yet. Send the same message by email or WhatsApp instead.
      </p>
      {mail || wa ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {mail ? (
            <a href={mail} className="btn btn-ink">
              Open in your email
            </a>
          ) : null}
          {wa ? (
            <a href={wa} className="btn btn-card" target="_blank" rel="noopener">
              Send on WhatsApp
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mt-4 text-ink-2">
            Our email and WhatsApp number are not set on this site yet. Copy your message and send it to us directly:
          </p>
          <label htmlFor="fallback-text" className="visually-hidden">
            Your message
          </label>
          <textarea
            id="fallback-text"
            readOnly
            value={text}
            className="field mt-3 min-h-36 w-full rounded-input border border-muted bg-cotton px-4 py-3 text-md text-ink"
          />
        </>
      )}
    </div>
  );
}

/** Reads ?salesmen=&shops=&phone=&topic= from the Pricing page's quote form. */
export function ContactFormFromQuery() {
  const params = useSearchParams();
  const pick = (k: string) => {
    const v = params.get(k)?.trim() ?? "";
    return v.length > 0 && v.length < 40 ? v : undefined;
  };
  const quote = params.get("topic") === "quote";
  return (
    <ContactForm
      initial={{
        salesmen: pick("salesmen"),
        shops: pick("shops"),
        phone: pick("phone"),
        message: quote ? "I would like a price for Bitaran." : undefined,
      }}
    />
  );
}
