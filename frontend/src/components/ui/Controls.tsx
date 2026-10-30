"use client";

// Tabs, Stepper, DateRangePicker, DemoImage and ImageViewer.

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { addDays, todayNepal, type BusinessDate } from "@/lib/dates";
import { Button } from "./Button";
import { Modal } from "./Overlay";
import { CameraIcon, MinusIcon, PlusIcon } from "./icons";

// ---- tabs --------------------------------------------------------------------------------

export type TabItem = { id: string; label: string; content: ReactNode };

/** ARIA tabs: arrow keys move between tabs, the coral marker shows the current one. */
export function Tabs({ items, value, onChange, label }: { items: TabItem[]; value?: string; onChange?: (id: string) => void; label: string }) {
  const [own, setOwn] = useState(items[0]?.id);
  const current = value ?? own;
  const select = (id: string) => (onChange ? onChange(id) : setOwn(id));
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = (n + items.length) % items.length;
    select(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-rule-2">
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={t.id === current}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={t.id === current ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className="tab"
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={t.id !== current} className="pt-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** The website's pressed groove, for a choice of two to four. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- stepper -----------------------------------------------------------------------------

/** A whole-number stepper with big +/− buttons, for the salesman's phone. Typing is optional. */
export function Stepper({ label, value, onChange, min = 0, max = 9999, unit }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; unit?: string }) {
  const id = useId();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min)));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-card btn-lg w-14 px-0" aria-label={`Fewer ${unit ?? ""}`.trim()} disabled={value <= min} onClick={() => set(value - 1)}>
          <MinusIcon className="size-6" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(e.currentTarget.valueAsNumber)}
          className="field field-lg w-24 rounded-input border border-muted bg-cotton text-center font-outlier text-ink"
        />
        <button type="button" className="btn btn-card btn-lg w-14 px-0" aria-label={`More ${unit ?? ""}`.trim()} disabled={value >= max} onClick={() => set(value + 1)}>
          <PlusIcon className="size-6" />
        </button>
        {unit ? <span className="text-ink-2">{unit}</span> : null}
      </div>
    </div>
  );
}

// ---- date range --------------------------------------------------------------------------

export type Range = { from: BusinessDate; to: BusinessDate };

export function presetRange(preset: "today" | "week" | "month", today: BusinessDate = todayNepal()): Range {
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: addDays(today, -6), to: today };
  return { from: addDays(today, -29), to: today };
}

/** Two date fields (Nepal dates, shown in AD) and quick presets. */
export function DateRangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const id = useId();
  const presets: [string, "today" | "week" | "month"][] = [["Today", "today"], ["Last 7 days", "week"], ["Last 30 days", "month"]];
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="visually-hidden">Date range</legend>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-from`} className="text-sm text-muted">
          From
        </label>
        <input id={`${id}-from`} type="date" value={value.from} max={value.to} onChange={(e) => e.currentTarget.value && onChange({ ...value, from: e.currentTarget.value })} className="field field-sm rounded-input border border-muted bg-cotton px-3 text-ink" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-to`} className="text-sm text-muted">
          To
        </label>
        <input id={`${id}-to`} type="date" value={value.to} min={value.from} onChange={(e) => e.currentTarget.value && onChange({ ...value, to: e.currentTarget.value })} className="field field-sm rounded-input border border-muted bg-cotton px-3 text-ink" />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(([label, p]) => {
          const r = presetRange(p);
          const on = r.from === value.from && r.to === value.to;
          return (
            <Button key={p} variant={on ? "primary" : "secondary"} size="sm" aria-pressed={on} onClick={() => onChange(r)}>
              {label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---- images ------------------------------------------------------------------------------

const DEMO_LABEL: Record<string, string> = { cheque: "Cheque photo", screenshot: "Payment screenshot", shop: "Shop visit photo", bill: "Bill photo" };

/**
 * A stored image. Demo images ("demo-img:kind:n") are drawn here from tokens, never fetched;
 * real ones (data or https URLs) are shown as they are.
 */
export function DemoImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  if (src.startsWith("demo-img:")) {
    const [, kind, n] = src.split(":");
    return (
      <div role="img" aria-label={`${alt} (demo image)`} className={`visit-photo relative flex flex-col items-start justify-end gap-1 overflow-hidden rounded-input p-3 ${className}`.trim()}>
        <CameraIcon className="size-6 text-ink-2" />
        <span className="rounded-input bg-board px-2 text-xs text-board-type">
          {DEMO_LABEL[kind] ?? "Photo"} {n}, demo
        </span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- captured images are data URLs or backend URLs, not static assets
  return <img src={src} alt={alt} className={`rounded-input object-cover ${className}`.trim()} />;
}

/** A thumbnail that opens the full image in a modal. */
export function ImageViewer({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="choice rounded-input" aria-label={`Open ${alt}`}>
        <DemoImage src={src} alt={alt} className="h-20 w-28" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={alt}>
        <DemoImage src={src} alt={alt} className="h-80 w-full" />
      </Modal>
    </>
  );
}
