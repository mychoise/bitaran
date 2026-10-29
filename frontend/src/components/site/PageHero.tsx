import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  lead: string;
  /** Shown above the headline when the whole page is a draft. */
  draft?: ReactNode;
  children?: ReactNode;
};

/** Banner hero for inner pages: the headline, one line, and whatever the page needs beside it. */
export function PageHero({ id, title, lead, draft, children }: Props) {
  return (
    <section aria-labelledby={id} className="desk pt-section-s pb-section-s">
      <div className="container grid grid-cols-1 items-center gap-x-columns gap-y-12 lg:grid-cols-12">
        <div className={`hero-text ${children ? "lg:col-span-7" : "lg:col-span-9"}`}>
          {draft ? <div className="mb-8">{draft}</div> : null}
          <h1 id={id}>{title}</h1>
          <p className="lead mt-6 text-ink-2">{lead}</p>
        </div>
        {children ? (
          <div className="hero-desk min-w-0 lg:col-span-5">
            <div className="desk-settle desk-settle-2">{children}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** A one-line note under content that is sample, not real. */
export function SampleNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
