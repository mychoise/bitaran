import { Placeholder } from "@/components/ui/Placeholder";

/**
 * Customer stories. There are none yet, so each card is a visible placeholder.
 * Replace with a real customer's words only once they have agreed to be quoted.
 */
export function Stories() {
  return (
    <section aria-labelledby="stories-title" className="bg-paper-2 py-section-s">
      <div className="container">
        <h2 id="stories-title">From wholesalers using it</h2>
        <div className="mt-16 grid gap-columns md:grid-cols-2">
          {[1, 2].map((n) => (
            <figure key={n} className="stock m-0 flex min-h-80 flex-col justify-between rounded-stock p-10">
              <blockquote className="m-0 text-title">
                <Placeholder label={`customer ${n} quote`} />
              </blockquote>
              <figcaption className="mt-10 flex flex-col items-start gap-2 text-sm">
                <Placeholder label={`customer ${n} name, role`} />
                <Placeholder label={`customer ${n} business, town`} />
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
