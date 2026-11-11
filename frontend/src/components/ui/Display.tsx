// Small display pieces: Card, Stat, PageHeader, Badge, StatusBadge, MoneyText, Skeleton.
// All built from the website's tokens and recipes (docs/design-language.md).

import { useTranslations } from "next-intl";
import type { HTMLAttributes, ReactNode } from "react";
import { formatBalance, formatMoney, type Paisa } from "@/lib/money";
import { AlertIcon, CheckIcon, ClockIcon, XCircleIcon } from "./icons";

/** The website's cotton card (.stock). `dense` for dashboards. Other attributes (aria-label…) pass through. */
export function Card({
  children,
  className = "",
  dense = false,
  as: Tag = "div",
  ...rest
}: { children: ReactNode; className?: string; dense?: boolean; as?: "div" | "section" | "article" } & Omit<HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <Tag className={`stock rounded-stock ${dense ? "p-5" : "p-8"} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
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

const STATUS_TONE: Record<string, BadgeTone> = {
  planned: "neutral",
  in_progress: "progress",
  closed: "warning",
  reconciled: "settled",
  confirmed: "success",
  pending: "progress",
  bounced: "danger",
  cancelled: "stopped",
  open: "progress",
  delivered: "success",
  overdue: "warning",
  over_limit: "danger",
  flagged: "warning",
  visited: "settled",
  skipped: "stopped",
  active: "success",
  inactive: "stopped",
};

/** The one place a record status becomes a badge, so every screen says it the same way. */
export function StatusBadge({ status, label }: { status: keyof typeof STATUS_TONE | string; label?: string }) {
  const t = useTranslations("Status");
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{label ?? (t.has(status) ? t(status) : status)}</Badge>;
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
