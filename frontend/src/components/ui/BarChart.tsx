"use client";

// One series of bars over time (or any ordered labels), drawn as plain SVG. Thin bars with 4px
// rounded tops on the baseline and a gap between them; a light grid; text in ink, never in the
// bar colour. Each bar answers hover and focus with its value, and the same numbers are one
// click away as a table. A single series needs no legend: the title names it.

import { useId, useState } from "react";
import { Button } from "./Button";

export type Bar = { key: string; label: string; value: number; /** The value as people read it, e.g. "Rs 4,670.00". */ display: string };

const W = 640;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 8 };

/** A bar path with 4px rounded top corners, anchored flat on the baseline. */
function barPath(x: number, w: number, top: number, base: number) {
  const r = Math.min(4, w / 2, (base - top) / 2);
  if (base - top <= 0) return "";
  return `M${x} ${base} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${base} Z`;
}

export function BarChart({ title, bars, valueLabel }: { title: string; bars: Bar[]; /** Column heading for the table view. */ valueLabel: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const innerW = W - PAD.left - PAD.right;
  const base = H - PAD.bottom;
  const slot = bars.length ? innerW / bars.length : innerW;
  const gap = Math.min(2 + slot * 0.25, 12);
  const barW = Math.max(2, slot - gap);
  const y = (v: number) => base - (v / max) * (base - PAD.top);
  // Label every bar when there is room, otherwise about seven along the axis.
  const every = Math.max(1, Math.ceil(bars.length / 7));
  const a = active !== null ? bars[active] : null;
  const ax = active !== null ? PAD.left + active * slot + slot / 2 : 0;

  return (
    <figure className="m-0" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <figcaption id={`${id}-title`} className="text-title font-semibold tracking-normal">
          {title}
        </figcaption>
        <Button variant="quiet" size="sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show as chart" : "Show as table"}
        </Button>
      </div>
      {bars.length === 0 ? (
        <p className="mt-3 text-ink-2">Nothing in these dates.</p>
      ) : asTable ? (
        <div className="table-scroll mt-3">
          <table className="data-table">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="num">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b) => (
                <tr key={b.key}>
                  <th scope="row" className="font-normal">{b.label}</th>
                  <td className="num">{b.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="bar-chart mt-3 block h-auto w-full" role="group" aria-label={`${title}. ${bars.length} bars; use Tab to read each one.`} onMouseLeave={() => setActive(null)}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={PAD.left} x2={W - PAD.right} y1={y(max * f)} y2={y(max * f)} className="bar-grid" />
          ))}
          <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} className="bar-axis" />
          {bars.map((b, i) => {
            const x = PAD.left + i * slot + gap / 2;
            return (
              <g key={b.key}>
                <path d={barPath(x, barW, y(b.value), base)} className={`bar-mark ${active === i ? "is-active" : ""}`} />
                {/* The hit area is the whole column, bigger than the bar. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={base - PAD.top}
                  className="bar-hit"
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.label}: ${b.display}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
                {i % every === 0 ? (
                  <text x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="bar-label">
                    {b.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {a ? (
            <g className="bar-tip" aria-hidden transform={`translate(${Math.min(W - PAD.right - 84, Math.max(PAD.left + 84, ax))} ${Math.max(PAD.top + 22, y(a.value) - 12)})`}>
              <rect x="-84" y="-34" width="168" height="38" rx="6" className="bar-tip-box" />
              <text x="0" y="-19" textAnchor="middle" className="bar-tip-label">
                {a.label}
              </text>
              <text x="0" y="-4" textAnchor="middle" className="bar-tip-value">
                {a.display}
              </text>
            </g>
          ) : null}
        </svg>
      )}
    </figure>
  );
}
