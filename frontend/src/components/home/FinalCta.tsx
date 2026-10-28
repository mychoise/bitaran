import { config, whatsappHref } from "@/config";
import { ButtonLink } from "@/components/ui/ButtonLink";

/** The board: the one ink band, closing on the page's job, a demo request. */
export function FinalCta() {
  const wa = whatsappHref(`Hello, I would like a demo of ${config.productName}.`);
  return (
    <section aria-labelledby="cta-title" className="on-board bg-board py-section-s text-board-type">
      <div className="container grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 id="cta-title">See it with your own routes</h2>
          <p className="lead mt-6">
            Tell us how many salesmen and shops you have. We will find a time to show you {config.productName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 lg:col-span-5 lg:justify-end">
          <ButtonLink href={config.demoUrl} variant="card">
            Request a demo
          </ButtonLink>
          <ButtonLink href={wa ?? "/contact#whatsapp"} variant="card">
            Message us on WhatsApp
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
