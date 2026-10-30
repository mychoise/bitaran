// Small display pieces: Card, Stat, PageHeader, Badge, StatusBadge, MoneyText, Skeleton.
// All built from the website's tokens and recipes (docs/design-language.md).

import type { ReactNode } from "react";
import { formatBalance, formatMoney, type Paisa } from "@/lib/money";
import { AlertIcon, CheckIcon, ClockIcon, XCircleIcon } from "./icons";

/** The website's cotton card (.stock). `dense` for dashboards. */
export function Card({ children, className = "", dense = false, as: Tag = "div" }: { children: ReactNode; className?: string; dense?: boolean; as?: "div" | "section" | "article" }) {
  return <Tag className={`stock rounded-stock ${dense ? "p-5" : "p-8"} ${className}`.trim()}>{children}</Tag>;
}

/** A figure with its label, like the website's figure rows. No icon tiles. */
export function Stat({ label, value, note, loading }: { label: string; value: ReactNode; note?: ReactNode; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      {loading ? <Skeleton className="h-8 w-32" /> : <span className="font-outlier text-2xl leading-tight text-ink">{value}</span>}
      {note ? <span className="text-sm text-ink-2">{note}</span> : null}
    </div>
  );
}

/** Page title, optional line, actions on the right, and the website's 2px ink rule below. */
export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b-2 border-ink pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-section">{title}</h1>
        {lead ? <p className="mt-2 text-lg text-ink-2">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export type BadgeTone = "neutral" | "progress" | "settled" | "stopped" | "success" | "warning" | "danger";
const TONE: Record<BadgeTone, string> = {
  neutral: "",
  progress: "badge-progress",
  settled: "badge-settled",
  stopped: "badge-stopped",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
};
const TONE_ICON: Partial<Record<BadgeTone, ReactNode>> = {
  progress: <ClockIcon className="size-3.5" />,
  success: <CheckIcon className="size-3.5" />,
  warning: <AlertIcon className="size-3.5" />,
  danger: <XCircleIcon className="size-3.5" />,
};

/** A status chip: always words, plus an icon for the coloured tones (never colour alone). */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge ${TONE[tone]}`.trim()}>
      {TONE_ICON[tone]}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  planned: { tone: "neutral", label: "Planned" },
  in_progress: { tone: "progress", label: "In progress" },
  closed: { tone: "warning", label: "Closed, to count" },
  reconciled: { tone: "settled", label: "Reconciled" },
  confirmed: { tone: "success", label: "Confirmed" },
  pending: { tone: "progress", label: "Pending" },
  bounced: { tone: "danger", label: "Bounced" },
  cancelled: { tone: "stopped", label: "Cancelled" },
  overdue: { tone: "warning", label: "Overdue" },
  over_limit: { tone: "danger", label: "Over limit" },
  flagged: { tone: "warning", label: "Flagged" },
  visited: { tone: "settled", label: "Visited" },
  skipped: { tone: "stopped", label: "Skipped" },
  active: { tone: "success", label: "Active" },
  inactive: { tone: "stopped", label: "Inactive" },
};

/** The one place a record status becomes a badge, so every screen says it the same way. */
export function StatusBadge({ status, label }: { status: keyof typeof STATUS | string; label?: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={s.tone}>{label ?? s.label}</Badge>;
}

/** Money from paisa, in figures. `balance` shows a negative as "Credit Rs X". */
export function MoneyText({ paisa, balance = false, className = "" }: { paisa: Paisa; balance?: boolean; className?: string }) {
  const credit = balance && paisa < 0;
  return (
    <span className={`font-outlier tabular-nums whitespace-nowrap ${credit ? "text-success" : ""} ${className}`.trim()}>
      {balance ? formatBalance(paisa) : formatMoney(paisa)}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`.trim()} />;
}
