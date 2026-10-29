import type { Metadata } from "next";
import { Flow } from "@/components/how/FlowDiagram";
import { FinalCta } from "@/components/home/FinalCta";
import { OpeningSheet } from "@/components/product/OpeningSheet";
import { RouteScreen } from "@/components/product/RouteScreen";
import { PageHero, SampleNote } from "@/components/site/PageHero";
import { ProductFigure } from "@/components/ui/ProductFigure";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "/how-it-works",
  "How it works",
  "Get started in three steps, then see one day with Bitaran: the morning plan, sales at the shops, the evening count and the reports.",
);

const start = [
  { title: "Set up your business", line: "Staff logins, products, routes and the shops on each route." },
  { title: "Load what you start with", line: "Each shop's opening udharo, and the stock in your store." },
  { title: "Run your first day", line: "Stock out in the morning, sales on the route, the count at night." },
];

const day = [
  {
    time: "Morning",
    title: "The plan and the stock",
    line: "The manager makes the day plan and hands out stock. Routes appear on each phone in order.",
    example: "Example Salesman takes 20 cartons of noodles and 48 bottles of oil.",
  },
  {
    time: "During the day",
    title: "Shops, sales and payments",
    line: "At each shop the salesman sells, collects payment and takes a visit photo.",
    example: "At Example Kirana he sells 3 cartons and collects Rs 6,600 cash.",
  },
  {
    time: "Evening",
    title: "Close the day, count it back",
    line: "The salesman closes his day. The manager counts the stock and cash that come back.",
    example: "11 bottles of oil come back. The count shows 1 short.",
  },
  {
    time: "After",
    title: "The reports update",
    line: "Sales, balances, overdue udharo and low stock are up to date for the owner.",
    example: "Example Kirana now owes Rs 12,400, due on 20 Kartik.",
  },
];

const roles = [
  { role: "Owner", does: "Sees every sale, balance and report." },
  { role: "Manager", does: "Plans routes, issues stock, confirms cheques, counts returns." },
  { role: "Salesman", does: "Records his sales and payments. Sees only his own." },
  { role: "Shop", does: "Sees its own balance and statement." },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        id="how-title"
        title="From setup to the first evening count"
        lead="Three steps to get started, then the same loop every day: plan, sell, count."
      />

      <section aria-labelledby="start-title" className="py-section">
        <div className="container grid grid-cols-1 items-center gap-x-columns gap-y-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="start-title">Getting started</h2>
            <ol data-reveal="stagger" className="m-0 mt-12 list-none p-0">
              {start.map((s, i) => (
                <li key={s.title} className="draw-rule grid grid-cols-6 gap-4 py-6">
                  <span className="col-span-1 font-outlier text-display-s leading-none" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="col-span-5">
                    <h3>{s.title}</h3>
                    <p className="mt-2 text-lg text-ink-2">{s.line}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0 lg:col-span-5 lg:col-start-8">
            <ProductFigure slot="how-opening" screenshot="Opening balances and starting stock for a new business" caption="Step two for an example business">
              <OpeningSheet />
            </ProductFigure>
          </div>
        </div>
      </section>

      <section aria-labelledby="day-title" className="border-y border-rule bg-paper-2 py-section-s">
        <div className="container">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="day-title">A day with Bitaran</h2>
            <SampleNote>An example salesman and example shops</SampleNote>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-x-columns gap-y-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28">
                <ProductFigure slot="how-route" screenshot="Salesman's route screen on a phone">
                  <RouteScreen className="mx-auto lg:mx-0" />
                </ProductFigure>
              </div>
            </div>
            <ol className="m-0 list-none p-0 lg:col-span-7 lg:col-start-6">
              {day.map((d) => (
                <li key={d.time} data-reveal className="draw-rule pt-6 pb-24 last:pb-0">
                  <p className="text-lg font-medium text-muted">{d.time}</p>
                  <h3 className="mt-2 text-section">{d.title}</h3>
                  <p className="mt-4 text-lg text-ink-2">{d.line}</p>
                  <p className="stock mt-6 rounded-stock px-5 py-4 text-md">
                    <span className="font-semibold">Example: </span>
                    {d.example}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="roles-title" className="py-section">
        <div className="container">
          <h2 id="roles-title">Who does what</h2>
          <ul data-reveal="stagger" className="m-0 mt-16 grid list-none grid-cols-1 gap-columns p-0 sm:grid-cols-2 xl:grid-cols-4">
            {roles.map((r) => (
              <li key={r.role} className="stock flex min-h-60 flex-col rounded-stock p-8">
                <h3 className="text-section">{r.role}</h3>
                <p className="mt-auto pt-8 text-lg text-ink-2">{r.does}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="border-t border-rule bg-paper-2 py-section-s">
        <div className="container">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="flow-title">Where your money and stock go</h2>
            <SampleNote>Sample amounts</SampleNote>
          </div>
          <div className="mt-16 flex flex-col gap-16">
            <Flow
              caption="A shop's balance"
              inputs={[
                { label: "Balance before", value: "Rs 9,800", note: "Earlier udharo" },
                { label: "Sales", value: "Rs 6,600", note: "Each invoice adds" },
                { label: "Payments", value: "Rs 3,000", note: "Confirmed only. Bounced cheques never count." },
                { label: "Returns", value: "Rs 1,200", note: "Damaged or expired, credited" },
              ]}
              signs={["+", "−", "−", "="]}
              result={{ label: "Balance now", value: "Rs 12,200", note: "What the shop sees" }}
            />
            <Flow
              caption="One item's stock for one salesman"
              inputs={[
                { label: "Issued", value: "48", note: "Morning stock out" },
                { label: "Sold", value: "36", note: "From invoices" },
                { label: "Returned", value: "11", note: "The manager's count" },
              ]}
              signs={["−", "−", "="]}
              result={{ label: "Shortage", value: "1", note: "Shown the same night" }}
            />
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
