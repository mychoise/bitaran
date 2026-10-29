import type { ReactNode } from "react";

/** The top of every cotton sheet: a small label line, a title, and an optional note on the right. */
export function SheetHeader({ label, title, aside }: { label: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-print pb-4">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-semibold">{title}</p>
      </div>
      {aside ? <div className="text-sm text-muted">{aside}</div> : null}
    </div>
  );
}

/**
 * A status chip: ink outline for open states, filled ink for settled ones.
 * `pop` is the order it pops in when its sample scrolls into view (see globals.css).
 */
export function Status({ children, tone = "open", pop }: { children: ReactNode; tone?: "open" | "done" | "stop"; pop?: number }) {
  const cls =
    tone === "done"
      ? "bg-ink text-cotton border-ink"
      : tone === "stop"
        ? "border-print border-dashed"
        : "border-print";
  return (
    <span data-pop={pop} className={`inline-block rounded-input border px-2 text-xs font-medium whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
