import type { ReactNode } from "react";

/** A dashed box saying this content is a draft the owner must confirm before launch. */
export function DraftNotice({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="fill block max-w-2xl px-4 py-3 text-md">
      <strong className="font-semibold">[CONFIRM WITH ME]</strong> {children}
    </div>
  );
}
