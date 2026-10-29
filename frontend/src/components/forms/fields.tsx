import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** A labelled input with room reserved for its hint or error, so nothing jumps when one appears. */
export function TextField({ id, label, hint, error, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field h-12 rounded-input border border-muted bg-cotton px-4 text-md text-ink"
        {...input}
      />
      <FieldNote id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({ id, label, hint, error, ...area }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field min-h-36 rounded-input border border-muted bg-cotton px-4 py-3 text-md text-ink"
        {...area}
      />
      <FieldNote id={id} hint={hint} error={error} />
    </div>
  );
}

function FieldNote({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error)
    return (
      <p id={`${id}-error`} className="min-h-5 text-sm font-medium text-error">
        {error}
      </p>
    );
  return (
    <p id={`${id}-hint`} className="min-h-5 text-sm text-muted">
      {hint ?? ""}
    </p>
  );
}
