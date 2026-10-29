import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ContactForm, ContactFormFromQuery } from "@/components/forms/ContactForm";
import { FinalCta } from "@/components/home/FinalCta";
import { PageHero, SampleNote } from "@/components/site/PageHero";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { ChatIcon, MailIcon, PhoneIcon } from "@/components/ui/icons";
import { NeedsConfirmation } from "@/components/ui/Placeholder";
import { config, whatsappHref } from "@/config";
import { sampleContact, sampleContactAnswers, sampleOffice } from "@/content/samples";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(
  "/contact",
  "Contact",
  "Request a demo of Bitaran or ask a question. Call, email or message us on WhatsApp.",
);

const questions: AccordionItem[] = [
  { q: "What happens after I send this?", a: sampleContactAnswers.reply },
  { q: "Can you show us in person?", a: sampleContactAnswers.visit },
  { q: "What should I have ready for the demo?", a: "A rough count of your salesmen, shops and products, and how you record udharo today." },
];

type Block = { id: string; icon: ReactNode; title: string; line: string; value: string; href: string | null; sample: boolean };

function blocks(): Block[] {
  const wa = whatsappHref(`Hello, I would like to know more about ${config.productName}.`);
  return [
    {
      id: "sales",
      icon: <MailIcon className="size-6" />,
      title: "Sales",
      line: "Demos and prices.",
      value: config.salesEmail || sampleContact.salesEmail,
      href: config.salesEmail ? `mailto:${config.salesEmail}` : null,
      sample: !config.salesEmail,
    },
    {
      id: "support",
      icon: <PhoneIcon className="size-6" />,
      title: "Support",
      line: "For existing customers.",
      value: config.supportEmail || sampleContact.supportEmail,
      href: config.supportEmail ? `mailto:${config.supportEmail}` : null,
      sample: !config.supportEmail,
    },
    {
      id: "whatsapp",
      icon: <ChatIcon className="size-6" />,
      title: "WhatsApp",
      line: "Message or call.",
      value: config.whatsapp || sampleContact.phone,
      href: wa,
      sample: !config.whatsapp,
    },
  ];
}

export default function ContactPage() {
  const list = blocks();
  const anySample = list.some((b) => b.sample);
  return (
    <>
      <PageHero
        id="contact-title"
        title="Request a demo"
        lead="Tell us about your business and we will show you Bitaran."
      />

      <section aria-labelledby="form-title" className="py-section-s">
        <div className="container grid grid-cols-1 gap-x-columns gap-y-16 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <h2 id="form-title" className="text-title tracking-normal">
              Send us your details
            </h2>
            <div className="mt-6">
              <Suspense fallback={<ContactForm />}>
                <ContactFormFromQuery />
              </Suspense>
            </div>
          </div>

          <aside aria-labelledby="ways-title" className="lg:col-span-4 lg:col-start-9">
            <h2 id="ways-title" className="text-title tracking-normal">
              Or reach us directly
            </h2>
            <ul className="m-0 mt-6 flex list-none flex-col p-0">
              {list.map((b) => (
                <li key={b.id} id={b.id} className="flex gap-4 border-t border-rule-2 py-6">
                  <span className="mt-1 shrink-0">{b.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-lg tracking-normal">{b.title}</h3>
                    <p className="text-ink-2">{b.line}</p>
                    {b.href ? (
                      <a href={b.href} className="text-link mt-2 inline-block break-all">
                        {b.value}
                      </a>
                    ) : (
                      <p data-sample className="mt-2 font-medium break-all">
                        {b.value}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              <li className="border-t border-rule-2 py-6">
                <h3 className="text-lg tracking-normal">Office</h3>
                <p data-sample className="text-ink-2">{sampleOffice.address}</p>
                <p data-sample className="mt-1 text-ink-2">{sampleOffice.hours}</p>
              </li>
              <li className="border-t border-rule-2 py-6">
                <h3 className="text-lg tracking-normal">Where we work</h3>
                <p className="mt-1">
                  <NeedsConfirmation>Serving wholesalers across Nepal</NeedsConfirmation>
                </p>
              </li>
            </ul>
            <SampleNote>
              {anySample ? "Sample contact details, address and hours." : "Sample address and hours."}
            </SampleNote>
          </aside>
        </div>
      </section>

      <section aria-labelledby="contact-faq-title" className="border-t border-rule bg-paper-2 py-section-s">
        <div className="container grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="contact-faq-title">Before you write</h2>
            <div className="mt-6">
              <SampleNote>The first two answers are samples, to be confirmed</SampleNote>
            </div>
          </div>
          <div className="lg:col-span-8">
            <Accordion items={questions} />
          </div>
        </div>
      </section>

      <FinalCta demoHref="#form-title" />
    </>
  );
}
