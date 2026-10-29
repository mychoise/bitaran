import type { ReactNode } from "react";
import { DraftNotice } from "@/components/ui/DraftNotice";

/** A short legal page, clearly marked as a draft to be replaced by the real text. */
export function LegalPage({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <article aria-labelledby={id} className="pt-section-s pb-section">
      <div className="container">
        <DraftNotice>Draft. Replace before launch.</DraftNotice>
        <h1 id={id} className="mt-10 text-display-s">
          {title}
        </h1>
        <div className="legal mt-12 flex max-w-2xl flex-col gap-10 text-lg">{children}</div>
      </div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-title">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-ink-2">{children}</div>
    </section>
  );
}
