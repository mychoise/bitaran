import { sampleCustomers } from "@/content/samples";

/**
 * Customer strip. The names are samples (see src/content/samples.ts) until real customers
 * agree to be listed; the small note says so on the page.
 */
export function TrustedBy() {
  return (
    <section aria-labelledby="trusted-title" className="border-y border-rule bg-paper-2 py-12">
      <div className="container grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <h2 id="trusted-title" className="text-title tracking-normal">
            Wholesalers using Bitaran
          </h2>
          <p className="mt-1 text-sm text-muted">Sample names</p>
        </div>
        <ul className="m-0 grid list-none grid-cols-1 gap-x-columns gap-y-4 p-0 sm:grid-cols-2 lg:col-span-9 xl:grid-cols-4">
          {sampleCustomers.map((name) => (
            <li key={name} data-sample className="wordmark text-lg text-ink-2">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
