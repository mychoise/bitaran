import Link from "next/link";

const steps = [
  {
    title: "Set up the business",
    line: "A login for the owner, each manager and each salesman.",
  },
  {
    title: "Add products, routes and shops",
    line: "What you sell, your routes, and the shops on each route.",
  },
  {
    title: "Run the first day",
    line: "Stock out in the morning, sales all day, the count at night.",
  },
];

/** Steps: three stages across, as a real ordered list. */
export function GetStarted() {
  return (
    <section aria-labelledby="start-title" className="pt-section-l pb-section">
      <div className="container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="start-title">Three steps to your first day</h2>
          <Link href="/how-it-works" className="text-link text-lg">
            Full setup guide
          </Link>
        </div>
        <ol data-reveal="stagger" className="steps m-0 mt-16 grid list-none gap-x-columns gap-y-12 p-0 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="draw-rule pt-6">
              <span className="block font-outlier text-display-s leading-none text-ink" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mt-6">{s.title}</h3>
              <p className="mt-3 max-w-sm text-ink-2">{s.line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
