import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

export type FieldSize = "sm" | "md" | "lg";
const SIZE: Record<FieldSize, string> = { sm: "field-sm", md: "h-12", lg: "field-lg" };
const base = "field w-full rounded-input border border-muted bg-cotton px-4 text-md text-ink";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  /** Visually hide the label (it stays for screen readers). */
  hideLabel?: boolean;
  children: (control: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** A label, the control, and a reserved line for the hint or the error (announced when it appears). */
export function Field({ label, hint, error, hideLabel, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : "font-medium"}>
        {label}
      </label>
      {children({ id, describedBy: hint || error ? noteId : undefined, invalid: Boolean(error) })}
      <p id={noteId} role={error ? "alert" : undefined} className={`min-h-5 text-sm ${error ? "font-medium text-error" : "text-muted"}`}>
        {error ?? hint ?? ""}
      </p>
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string; hideLabel?: boolean; size?: FieldSize };

export function Input({ label, hint, error, hideLabel, size = "md", className = "", ...rest }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "size">) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${base} ${SIZE[size]} ${className}`} {...rest} />
      )}
    </Field>
  );
}

export function Select({ label, hint, error, hideLabel, size = "md", className = "", children, ...rest }: Common & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <div className="select-wrap">
          <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${base} ${SIZE[size]} ${className}`} {...rest}>
            {children}
          </select>
          <ChevronDownIcon className="size-5 text-muted" />
        </div>
      )}
    </Field>
  );
}

export function Textarea({ label, hint, error, hideLabel, className = "", ...rest }: Omit<Common, "size"> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={`${base} min-h-28 py-3 ${className}`} {...rest} />
      )}
    </Field>
  );
}

export function Checkbox({ label, hint, className = "", ...rest }: { label: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input id={id} type="checkbox" className="checkbox mt-0.5" aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block">{label}</span>
        {hint ? (
          <span id={`${id}-hint`} className="block text-sm text-muted">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}
