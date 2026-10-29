import { sampleStories } from "@/content/samples";

/**
 * Customer stories. These are samples (see src/content/samples.ts), marked as such on the page.
 * Replace them with real customers' words, used with their permission.
 */
export function Stories() {
  return (
    <section aria-labelledby="stories-title" className="bg-paper-2 pt-section-l pb-section-s">
      <div className="container">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="stories-title">From wholesalers using it</h2>
          <p className="text-sm text-muted">Sample stories</p>
        </div>
        <div data-reveal="stagger" className="mt-16 grid grid-cols-1 gap-columns md:grid-cols-2">
          {sampleStories.map((s) => (
            <figure key={s.business} data-sample className="stock m-0 flex min-h-80 flex-col justify-between rounded-stock p-10">
              <blockquote className="m-0 text-title leading-snug">
                <p>“{s.quote}”</p>
              </blockquote>
              <figcaption className="mt-10 text-sm">
                <span className="block font-semibold">
                  {s.role}, {s.business}
                </span>
                <span className="block text-muted">{s.town}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
