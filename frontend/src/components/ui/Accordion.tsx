"use client";

import { useId, useState, type ReactNode } from "react";
import { PlusIcon } from "./icons";

export type AccordionItem = { q: string; a: ReactNode };

/**
 * Questions as ruled rows. Answers are in the static HTML (search engines read them) and
 * hidden until opened; with JavaScript off, a <noscript> rule shows them all.
 */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();
  return (
    <div className="border-b border-rule-2">
      <noscript>
        <style>{".faq-panel[hidden]{display:block}"}</style>
      </noscript>
      {items.map((item, i) => {
        const isOpen = open === i;
        const qId = `${base}-q${i}`;
        const panelId = `${base}-a${i}`;
        return (
          <div key={item.q} className="border-t border-rule-2">
            <div className="faq-row relative flex min-h-18 items-center justify-between gap-6 py-5">
              <h3 id={qId} className="text-title">
                {item.q}
              </h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-labelledby={qId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="faq-toggle flex size-11 shrink-0 items-center justify-center rounded-input"
              >
                <PlusIcon className="faq-mark size-6" />
              </button>
            </div>
            <div id={panelId} role="region" aria-labelledby={qId} hidden={!isOpen} className="faq-panel">
              <p className="max-w-2xl pb-8 text-lg text-ink-2">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
