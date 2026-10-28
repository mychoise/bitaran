import { Placeholder } from "@/components/ui/Placeholder";

/**
 * Customer strip. No customer has been named yet, so every entry is a visible placeholder.
 * Replace each with a real customer's name or logo once they agree to be listed.
 */
export function TrustedBy() {
  return (
    <section aria-labelledby="trusted-title" className="border-y border-rule bg-paper-2 py-12">
      <div className="container grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <h2 id="trusted-title" className="text-title tracking-normal lg:col-span-3">
          Wholesalers using Bitaran
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:col-span-9">
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>
              <Placeholder label={`customer logo ${n}`} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
