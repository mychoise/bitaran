import Link from "next/link";

const features = [
  { title: "Routes in order", line: "Today's shops on his phone, in order." },
  { title: "Udharo with limits", line: "Limits, balances, due dates. Overdue shops stand out." },
  { title: "Cheques that wait", line: "Photo required. Pending until a manager confirms." },
  { title: "Visits you can check", line: "A time-stamped photo, checked against location." },
  { title: "Stock counted at night", line: "Out in the morning, counted at night." },
  { title: "Today's numbers", line: "Sales, overdue credit and low stock, by day." },
];

/** Six things the product does, as a ruled 3 by 2 grid. Titles carry the cells; no icons. */
export function KeyFeatures() {
  return (
    <section aria-labelledby="features-title" className="py-section">
      <div className="container">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="features-title">One place for the whole route</h2>
          <Link href="/features" className="text-link text-lg">
            Every feature, in detail
          </Link>
        </div>
        <ul data-reveal="stagger" className="m-0 mt-16 grid list-none grid-cols-1 gap-x-columns p-0 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.title} className="draw-rule pt-6 pb-14">
              <h3>{f.title}</h3>
              <p className="mt-3 max-w-xs text-lg text-ink-2">{f.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
