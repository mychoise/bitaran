import type { Metadata } from "next";
import { FinalCta } from "@/components/home/FinalCta";
import { SetupChecklist } from "@/components/product/SetupChecklist";
import { PageHero, SampleNote } from "@/components/site/PageHero";
import { DraftNotice } from "@/components/ui/DraftNotice";
import { ProductFigure } from "@/components/ui/ProductFigure";
import { sampleServices } from "@/content/samples";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "/services",
  "Services",
  "Help around the software: setup, importing your shops and opening balances, staff training, support by phone or WhatsApp, and custom requests.",
);

// [CONFIRM WITH ME] The owner has not confirmed which services are offered. The whole page is a draft.
const services = [
  {
    title: "Setup and onboarding",
    body: "We create your business and give the owner, managers and salesmen their own logins.",
    get: "A working account for everyone on day one.",
  },
  {
    title: "Importing your data",
    body: "We load your shops, products and opening balances from notebooks or spreadsheets.",
    get: "Udharo carried over, so nothing starts from zero.",
  },
  {
    title: "Staff training",
    body: "We show each person the parts they use, on their own phones.",
    get: "Salesmen who can record a sale before the first route.",
  },
  {
    title: "Ongoing support",
    body: "Call or WhatsApp us when something is unclear.",
    get: "A person who knows your setup.",
  },
  {
    title: "Custom requests",
    body: sampleServices.customRequests,
    get: "We tell you plainly whether we can do it.",
    sample: true,
  },
];

const steps = [
  { title: "Talk", line: "How your routes and udharo work today." },
  { title: "Set up", line: `${sampleServices.setupTime}.` },
  { title: "Train", line: `${sampleServices.trainingLength}.` },
  { title: "Go live", line: "Your first full day." },
  { title: "Support", line: `Phone or WhatsApp, ${sampleServices.supportHours}.` },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        id="services-title"
        title="We set it up with you"
        lead="Setup, your data, training and support, so your team uses it from the first day."
        draft={<DraftNotice>Draft page. The services and timings here have not been confirmed yet.</DraftNotice>}
      >
        <ProductFigure slot="services-setup" screenshot="Onboarding checklist for a new business" caption="An example business part way through setup">
          <SetupChecklist />
        </ProductFigure>
      </PageHero>

      <section aria-labelledby="offer-title" className="py-section">
        <div className="container">
          <h2 id="offer-title">Five ways we help</h2>
          <ol className="m-0 mt-16 list-none border-b border-rule-2 p-0">
            {services.map((s, i) => (
              <li key={s.title} data-reveal className="grid grid-cols-1 items-center gap-x-columns gap-y-4 border-t border-rule-2 py-12 lg:min-h-80 lg:grid-cols-12">
                <h3 className="text-section lg:col-span-5">
                  {i + 1}. {s.title}
                </h3>
                <div className="lg:col-span-6 lg:col-start-7">
                  <p className="text-lg text-ink-2">{s.body}</p>
                  <p className="mt-4 font-medium">{s.get}</p>
                  {s.sample ? (
                    <div className="mt-3">
                      <SampleNote>Sample description, to be confirmed</SampleNote>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="work-title" className="border-y border-rule bg-paper-2 py-section-s">
        <div className="container">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="work-title">How we work with you</h2>
            <SampleNote>Timings are samples, to be confirmed</SampleNote>
          </div>
          <ol data-reveal="stagger" className="m-0 mt-16 grid list-none grid-cols-1 gap-x-columns gap-y-10 p-0 md:grid-cols-3 xl:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="draw-rule pt-5">
                <span className="block font-outlier text-3xl leading-none" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-5">{s.title}</h3>
                <p className="mt-2 text-ink-2">{s.line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
