import Image from "next/image";
import chillies from "../../../public/photos/chillies.jpg";

const points = [
  { term: "Routes by place name", line: "Bagar to Lamachaur, set up the way your salesmen already ride it." },
  { term: "Pasals", line: "Every shop keeps its own record: what it bought, what it paid, what it owes." },
  { term: "Udharo", line: "A credit limit, a running balance and a due date for each shop." },
  { term: "Cheques", line: "Photographed at the counter, pending until the manager confirms them." },
  { term: "Khaja and fuel", line: "Daily expenses sit beside the day's sales, with salary and the rest." },
];

/** Split: one photograph of goods in bulk, and the local terms the product is built around. */
export function BuiltForNepal() {
  return (
    <section aria-labelledby="nepal-title" className="bg-paper-2 py-section-s">
      <div className="container grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
        <figure
          data-reveal="photo"
          data-slot="goods"
          data-alt="Goods in bulk at a Nepali wholesaler: sacks, cartons or a loaded delivery"
          className="relative m-0 aspect-4/5 min-h-110 overflow-hidden rounded-card max-lg:hidden lg:col-span-5"
        >
          <Image
            src={chillies}
            alt="A bowl of red chillies sitting in a heap of more chillies at a market"
            fill
            sizes="(min-width: 64rem) 40vw, 100vw"
            placeholder="blur"
            className="object-cover"
          />
        </figure>
        <div className="lg:col-span-6 lg:col-start-7">
          <h2 id="nepal-title">Made for how wholesale works in Nepal</h2>
          <p className="lead mt-6 text-ink-2">The words your team already uses, in the order they already work.</p>
          <dl data-reveal="stagger" className="m-0 mt-12">
            {points.map((p) => (
              <div key={p.term} className="grid gap-2 border-t border-rule-2 py-5 sm:grid-cols-5 sm:gap-6">
                <dt className="text-title font-semibold sm:col-span-2">{p.term}</dt>
                <dd className="m-0 text-ink-2 sm:col-span-3">{p.line}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
