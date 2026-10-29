import type { ReactNode } from "react";
import { ProductFigure } from "@/components/ui/ProductFigure";

export type FeatureLayout = "text-left" | "visual-left" | "stacked";

export type Feature = {
  id: string;
  title: string;
  /** The feature's plain name, used in the page index. */
  short: string;
  body: string;
  who: string;
  saves: string;
  layout: FeatureLayout;
  /** What the real screenshot for this slot should show. */
  screenshot: string;
  visual: ReactNode;
};

function Facts({ who, saves }: { who: string; saves: string }) {
  return (
    <dl className="m-0 mt-8 flex flex-col gap-4 border-t border-rule-2 pt-5">
      <div>
        <dt className="text-sm text-muted">Who uses it</dt>
        <dd className="m-0 mt-1 font-medium">{who}</dd>
      </div>
      <div>
        <dt className="text-sm text-muted">What it saves you</dt>
        <dd className="m-0 mt-1 font-medium">{saves}</dd>
      </div>
    </dl>
  );
}

/**
 * One feature: headline, what it does, who uses it, what it saves, and its product sample.
 * Three layouts rotate down the page so neighbouring features never share a shape.
 */
export function FeatureBlock({ feature: f }: { feature: Feature }) {
  const figure = (
    <ProductFigure slot={`feature-${f.id}`} screenshot={f.screenshot}>
      {f.visual}
    </ProductFigure>
  );

  if (f.layout === "stacked") {
    return (
      <article id={f.id} aria-labelledby={`${f.id}-title`} className="pt-section-l pb-section">
        <div className="grid grid-cols-1 gap-x-columns gap-y-6 lg:grid-cols-12">
          <h3 id={`${f.id}-title`} className="text-section lg:col-span-5">{f.title}</h3>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-lg text-ink-2">{f.body}</p>
            <Facts who={f.who} saves={f.saves} />
          </div>
        </div>
        <div data-reveal className="mt-16">{figure}</div>
      </article>
    );
  }

  const visualLeft = f.layout === "visual-left";
  return (
    <article
      id={f.id}
      aria-labelledby={`${f.id}-title`}
      className="grid grid-cols-1 items-center gap-x-columns gap-y-12 py-section-s lg:min-h-225 lg:grid-cols-12"
    >
      <div className={visualLeft ? "lg:order-2 lg:col-span-4 lg:col-start-9" : "lg:col-span-4"}>
        <h3 id={`${f.id}-title`} className="text-section">{f.title}</h3>
        <p className="mt-5 text-lg text-ink-2">{f.body}</p>
        <Facts who={f.who} saves={f.saves} />
      </div>
      <div data-reveal className={visualLeft ? "min-w-0 lg:order-1 lg:col-span-7" : "min-w-0 lg:col-span-7 lg:col-start-6"}>
        {figure}
      </div>
    </article>
  );
}
