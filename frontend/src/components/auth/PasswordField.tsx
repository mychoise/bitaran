"use client";

import { useState, type KeyboardEvent } from "react";

type Props = {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** A password input with a show/hide toggle and a caps-lock warning. The value is never logged. */
export function PasswordField({ id, label, autoComplete, error, hint, disabled, autoFocus }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  const noteId = `${id}-note`;
  const capsId = `${id}-caps`;
  const describedBy = [noteId, capsLock ? capsId : ""].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onKeyUp={checkCaps}
          onKeyDown={checkCaps}
          onBlur={() => setCapsLock(false)}
          className="field h-12 w-full rounded-input border border-muted bg-cotton pr-20 pl-4 text-md text-ink"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-pressed={visible}
          className="pw-toggle absolute inset-y-1 right-1 rounded-input px-3 text-sm font-medium text-ink"
        >
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
      {capsLock ? (
        <p id={capsId} className="text-sm font-medium text-ink">
          Caps Lock is on.
        </p>
      ) : null}
      <p id={noteId} role={error ? "alert" : undefined} className={`min-h-5 text-sm ${error ? "font-medium text-error" : "text-muted"}`}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}
