import type { Metadata } from "next";
import { DayScroller, type DayPart } from "@/components/how/DayScroller";
import { Flow } from "@/components/how/FlowDiagram";
import { RoleExplorer, type Role } from "@/components/how/RoleExplorer";
import { FinalCta } from "@/components/home/FinalCta";
import { DailyPlanSheet } from "@/components/product/DailyPlanSheet";
import { OpeningSheet } from "@/components/product/OpeningSheet";
import { ReportsBoard } from "@/components/product/ReportsBoard";
import { RouteScreen } from "@/components/product/RouteScreen";
import { ShopStatementScreen } from "@/components/product/ShopStatementScreen";
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

const day: DayPart[] = [
  {
    time: "Morning",
    short: "Morning",
    title: "The plan and the stock",
    line: "The manager makes the day plan and hands out stock. Routes appear on each phone in order.",
    example: "Example Salesman takes 20 cartons of noodles and 48 bottles of oil.",
  },
  {
    time: "During the day",
    short: "Day",
    title: "Shops, sales and payments",
    line: "At each shop the salesman sells, collects payment and takes a visit photo.",
    example: "At Example Kirana he sells 3 cartons and collects Rs 6,600 cash.",
  },
  {
    time: "Evening",
    short: "Evening",
    title: "Close the day, count it back",
    line: "The salesman closes his day. The manager counts the stock and cash that come back.",
    example: "11 bottles of oil come back. The count shows 1 short.",
  },
  {
    time: "After",
    short: "After",
    title: "The reports update",
    line: "Sales, balances, overdue udharo and low stock are up to date for the owner.",
    example: "Example Kirana now owes Rs 12,400, due on 20 Kartik.",
  },
];

const roles: Role[] = [
  {
    name: "Owner",
    where: "On a computer or a phone",
    summary: "Sees the whole business, and is the one who sets it up: the business details, the managers and the salesmen.",
    day: [
      { when: "Morning", what: "Looks at yesterday's sales and which shops owe money." },
      { when: "Day", what: "Watches sales and payments come in, route by route." },
      { when: "Evening", what: "Sees the count, any shortage, and the day's totals." },
    ],
    can: ["See every sale, payment and balance", "See cost prices and margins", "Add managers and salesmen", "Change the business settings"],
    cannot: [],
    visual: (
      <ProductFigure slot="how-role-owner" screenshot="Owner's reports: sales, balances and stock">
        <ReportsBoard />
      </ProductFigure>
    ),
  },
  {
    name: "Manager",
    where: "On a computer",
    summary: "Runs the day: plans each route, hands out the stock, confirms payments and counts what comes back.",
    day: [
      { when: "Morning", what: "Makes each salesman's plan and issues his stock." },
      { when: "Day", what: "Confirms cheques and online payments as they arrive." },
      { when: "Evening", what: "Counts the stock and cash that come back." },
    ],
    can: ["Plan routes and issue stock", "Confirm or bounce cheques", "Count returns and see shortages", "Add salesmen"],
    cannot: ["Change the business settings", "Add other managers"],
    visual: (
      <ProductFigure slot="how-role-manager" screenshot="Manager's morning plan: route, shops in order, stock issued">
        <DailyPlanSheet />
      </ProductFigure>
    ),
  },
  {
    name: "Salesman",
    where: "On his phone",
    summary: "Rides the route and records every visit: the sale, the payment and a photo, shop by shop.",
    day: [
      { when: "Morning", what: "Sees his route in order and the stock he carries." },
      { when: "Day", what: "Sells, takes payment and a visit photo at each shop." },
      { when: "Evening", what: "Closes his day and hands back stock and cash." },
    ],
    can: ["See his own route, sales and payments", "Check a shop's balance before selling", "Photograph cheques and visits"],
    cannot: ["See other salesmen's work", "See cost prices", "Sell past a shop's credit limit without a manager"],
    visual: (
      <ProductFigure slot="how-role-salesman" screenshot="Salesman's route screen on a phone">
        <RouteScreen className="mx-auto" />
      </ProductFigure>
    ),
  },
  {
    name: "Shop",
    where: "On its phone",
    summary: "Sees its own account with you at any time, so there is no argument about what it owes.",
    day: [
      { when: "Morning", what: "Checks what it owes before the salesman comes." },
      { when: "Day", what: "Gets an invoice for every sale." },
      { when: "Evening", what: "Sees a cheque as pending until it clears." },
    ],
    can: ["See its balance and due dates", "See its statement, invoices and payments", "See its returns"],
    cannot: ["See other shops", "Change anything: it only views"],
    visual: (
      <ProductFigure slot="how-role-shop" screenshot="A shop's own balance and statement">
        <ShopStatementScreen className="mx-auto" />
      </ProductFigure>
    ),
  },
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
          <DayScroller parts={day} />
        </div>
      </section>

      <section aria-labelledby="roles-title" className="py-section">
        <div className="container">
          <h2 id="roles-title">Who does what</h2>
          <p className="lead mt-6 max-w-3xl text-ink-2">Four kinds of login. Each one sees what that job needs, and nothing more. Choose one to see its day.</p>
          <RoleExplorer roles={roles} />
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
