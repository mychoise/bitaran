"use client";

// "Who does what": one tab per kind of login. Each shows where that person uses Bitaran, their
// morning, day and evening, what they can and cannot do, and the screen they work in.
// A tab list with arrow keys, Home and End; every panel is in the page for search engines and
// for anyone without JavaScript, with only the chosen one shown.

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon, MinusIcon } from "@/components/ui/icons";

export type Role = {
  name: string;
  where: string;
  summary: string;
  day: { when: string; what: string }[];
  can: string[];
  cannot: string[];
  visual: ReactNode;
};

export function RoleExplorer({ roles }: { roles: Role[] }) {
  const [chosen, setChosen] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = roles.length - 1;
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    setChosen(to);
    tabs.current[to]?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label="Kinds of login" className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {roles.map((r, i) => (
          <button
            key={r.name}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === chosen}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === chosen ? 0 : -1}
            onClick={() => setChosen(i)}
            onKeyDown={(e) => onKey(e, i)}
            className="role-tab stock rounded-stock p-5 text-left lg:p-6"
          >
            <span className="block text-title font-semibold">{r.name}</span>
            <span className="mt-1 block text-sm text-muted">{r.where}</span>
          </button>
        ))}
      </div>

      {roles.map((r, i) => (
        <div
          key={r.name}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== chosen}
          tabIndex={0}
          className="role-panel mt-10 grid grid-cols-1 gap-x-columns gap-y-12 lg:grid-cols-12"
        >
          <div className="lg:col-span-5">
            <p className="lead text-ink-2">{r.summary}</p>

            <h3 className="mt-10 text-sm font-semibold tracking-wide text-muted uppercase">Their day</h3>
            <dl className="m-0 mt-3">
              {r.day.map((d) => (
                <div key={d.when} className="grid grid-cols-4 gap-4 border-t border-rule-2 py-3">
                  <dt className="font-outlier text-sm text-muted">{d.when}</dt>
                  <dd className="col-span-3 m-0">{d.what}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Can</h3>
                <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                  {r.can.map((c) => (
                    <li key={c} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill bg-ink text-cotton" aria-hidden>
                        <CheckIcon className="size-3.5" />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Cannot</h3>
                {r.cannot.length === 0 ? <p className="mt-3 text-ink-2">Nothing is hidden from the {r.name.toLowerCase()}.</p> : null}
                <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                  {r.cannot.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-ink-2">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border border-rule-2 text-muted" aria-hidden>
                        <MinusIcon className="size-3.5" />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-7">{r.visual}</div>
        </div>
      ))}
    </>
  );
}
