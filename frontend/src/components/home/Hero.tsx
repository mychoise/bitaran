import { config } from "@/config";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ChequeCard } from "@/components/product/ChequeCard";
import { Invoice } from "@/components/product/Invoice";
import { RouteScreen } from "@/components/product/RouteScreen";

/**
 * Settled hero: the promise on the left, and on the right the day laid out on a desk:
 * the salesman's route on his phone, a paid invoice and a cheque waiting for the manager.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="desk hero-screen flex items-center py-16">
      <div className="container grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
        <div className="hero-text lg:col-span-6">
          <h1 id="hero-title">Know what every salesman sold today.</h1>
          <p className="lead mt-6 text-ink-2">
            Routes, udharo, cheques and the evening stock count for wholesalers supplying pasals.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href={config.demoUrl}>Request a demo</ButtonLink>
            <ButtonLink href="#day" variant="card">
              See a salesman&apos;s day
            </ButtonLink>
          </div>
        </div>
        <figure
          data-slot="hero"
          data-kind="product"
          data-alt="Salesman's route screen on a phone, beside an invoice and a pending cheque"
          className="hero-desk relative m-0 overflow-visible bg-transparent bg-none max-lg:hidden lg:col-span-6 lg:h-150"
        >
          <Invoice className="desk-settle absolute top-2 -left-4 -rotate-2" />
          <ChequeCard className="desk-settle desk-settle-2 absolute bottom-10 -left-2 rotate-1" />
          <RouteScreen className="desk-settle desk-settle-3 absolute top-0 right-0" />
          <figcaption className="absolute bottom-0 -left-4 text-sm text-muted">Sample data</figcaption>
        </figure>
        {/* Narrow screens: the phone alone, in the flow. */}
        <figure className="hero-desk m-0 lg:hidden">
          <RouteScreen className="mx-auto" />
          <figcaption className="mt-4 text-center text-sm text-muted">Sample data</figcaption>
        </figure>
      </div>
    </section>
  );
}
