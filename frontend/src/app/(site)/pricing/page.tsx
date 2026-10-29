import type { Metadata } from "next";
import { TextField } from "@/components/forms/fields";
import { PageHero, SampleNote } from "@/components/site/PageHero";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DraftNotice } from "@/components/ui/DraftNotice";
import { samplePricingAnswers } from "@/content/samples";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "/pricing",
  "Pricing",
  "Bitaran is priced for your business: the number of salesmen and shops, data import and training, and the support you need. Ask for a quote.",
);

// [CONFIRM WITH ME] The factors that set the price.
const factors = [
  { what: "Number of salesmen", line: "Each salesman has his own login and route." },
  { what: "Number of shops", line: "Every shop you sell to, with its own balance." },
  { what: "Data import and training", line: "Whether we load your shops and balances, and train your staff." },
  { what: "Level of support", line: "How much help you want by phone and WhatsApp." },
];

const questions: AccordionItem[] = [
  { q: "Do you charge per salesman?", a: samplePricingAnswers.perSalesman },
  { q: "Is setup included?", a: samplePricingAnswers.setup },
  { q: "How do we pay?", a: samplePricingAnswers.billing },
  { q: "Can we add salesmen later?", a: samplePricingAnswers.change },
];

/** Get a quote: a plain GET form, so the values reach /contact in the query string even without JavaScript. */
function QuoteForm() {
  return (
    <form action="/contact" method="get" className="stock rounded-stock p-8">
      <h2 className="text-title tracking-normal">Get a quote</h2>
      <p className="mt-2 text-ink-2">We open the contact form with these filled in.</p>
      <input type="hidden" name="topic" value="quote" />
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <TextField id="salesmen" label="Salesmen" type="number" inputMode="numeric" min={1} max={999} required />
        <TextField id="shops" label="Shops" type="number" inputMode="numeric" min={1} max={99999} required />
      </div>
      <TextField id="phone" label="Phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="98XXXXXXXX" required />
      <button type="submit" className="btn btn-ink mt-4 w-full">
        Continue to the contact form
      </button>
    </form>
  );
}

export default function PricingPage() {
  return (
    <>
      <PageHero
        id="pricing-title"
        title="Pricing depends on your business"
        lead="There is no fixed list yet. Tell us the size of your business and we send you a price."
      >
        <QuoteForm />
      </PageHero>

      <section aria-labelledby="factors-title" className="py-section">
        <div className="container grid grid-cols-1 gap-x-columns gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="factors-title">What affects the price</h2>
            <div className="mt-8">
              <DraftNotice>This list has not been confirmed yet.</DraftNotice>
            </div>
          </div>
          <dl data-reveal="stagger" className="m-0 border-b border-rule-2 lg:col-span-7 lg:col-start-6">
            {factors.map((f) => (
              <div key={f.what} className="grid grid-cols-1 gap-2 border-t border-rule-2 py-8 sm:grid-cols-2 sm:gap-8">
                <dt className="text-title font-semibold">{f.what}</dt>
                <dd className="m-0 text-lg text-ink-2">{f.line}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="pricing-faq-title" className="border-t border-rule bg-paper-2 py-section-s">
        <div className="container grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="pricing-faq-title">Pricing questions</h2>
            <div className="mt-6">
              <SampleNote>Sample answers, to be confirmed</SampleNote>
            </div>
          </div>
          <div className="lg:col-span-8">
            <Accordion items={questions} />
          </div>
        </div>
      </section>

      <section aria-labelledby="quote-cta-title" className="on-board bg-board py-section-s text-board-type">
        <div className="container flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="quote-cta-title">Ask for your price</h2>
            <p className="lead mt-6">Tell us how many salesmen and shops you have.</p>
          </div>
          <ButtonLink href="/contact?topic=quote" variant="card">
            Request a quote
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
