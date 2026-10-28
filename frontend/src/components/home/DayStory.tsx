import Link from "next/link";
import { DailyPlanSheet } from "@/components/product/DailyPlanSheet";
import { ReconcileSheet } from "@/components/product/ReconcileSheet";
import { ShopVisitScreen } from "@/components/product/ShopVisitScreen";
import { ProductFigure } from "@/components/ui/ProductFigure";
import type { ReactNode } from "react";

type Stage = {
  id: string;
  title: string;
  line: string;
  more: { href: string; label: string };
  visual: ReactNode;
};

const stages: Stage[] = [
  {
    id: "morning",
    title: "Morning: the plan",
    line: "The manager gives each salesman a route and the stock to carry. The shops appear on his phone in order.",
    more: { href: "/features#routes", label: "Routes and daily plans" },
    visual: (
      <ProductFigure slot="day-morning" screenshot="Manager's daily plan screen: salesman, route, stock issued">
        <DailyPlanSheet />
      </ProductFigure>
    ),
  },
  {
    id: "field",
    title: "At the pasal: the sale",
    line: "He sees what the shop bought before and what it owes, records today's sale, and takes the payment and a visit photo.",
    more: { href: "/features#payments", label: "Payments and visit photos" },
    visual: (
      <ProductFigure slot="day-field" screenshot="Salesman's shop screen: balance, history, today's sale, payment, visit photo">
        <ShopVisitScreen />
      </ProductFigure>
    ),
  },
  {
    id: "evening",
    title: "Evening: the count",
    line: "Unsold stock comes back and the manager counts it. Anything missing shows as a shortage.",
    more: { href: "/features#reconcile", label: "End-of-day reconcile" },
    visual: (
      <ProductFigure slot="day-evening" screenshot="Manager's end-of-day reconcile: issued, sold, returned, shortage">
        <ReconcileSheet />
      </ProductFigure>
    ),
  },
];

/** Narrative Workflow: one salesman's day in three stages, each shown in a different document. */
export function DayStory() {
  return (
    <section id="day" aria-labelledby="day-title" className="py-section-l">
      <div className="container">
        <h2 id="day-title">A salesman&apos;s day, start to finish</h2>
        <ol className="m-0 mt-16 flex list-none flex-col p-0">
          {stages.map((s, i) => (
            <li
              key={s.id}
              className="grid grid-cols-1 gap-10 border-t border-rule-2 py-16 first:border-t-2 first:border-ink last:pb-0 lg:grid-cols-12 lg:gap-x-columns"
            >
              <div className="lg:col-span-4">
                <h3 className="text-section">
                  {i + 1}. {s.title}
                </h3>
                <p className="mt-5 text-lg text-ink-2">{s.line}</p>
                <Link href={s.more.href} className="text-link mt-6 inline-block">
                  {s.more.label}
                </Link>
              </div>
              <div className="min-w-0 lg:col-span-8">{s.visual}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
