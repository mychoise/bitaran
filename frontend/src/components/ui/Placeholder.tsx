import type { ReactNode } from "react";

/**
 * A fact we do not have yet. Renders as a dashed "[PLACEHOLDER: …]" blank so it is
 * impossible to mistake for real content. Search the code for <Placeholder to find every one.
 */
export function Placeholder({ label }: { label: string }) {
  return (
    <span className="fill" data-placeholder={label}>
      [PLACEHOLDER: {label}]
    </span>
  );
}

/** Marks a block whose content the owner still has to confirm. */
export function NeedsConfirmation({ children }: { children?: ReactNode }) {
  return (
    <span className="fill" data-placeholder="confirm">
      [CONFIRM WITH ME]{children ? <> {children}</> : null}
    </span>
  );
}
