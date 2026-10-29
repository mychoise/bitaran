const rows = [
  {
    device: "Phone browser",
    who: "Salesmen and shops",
    what: "Sales, payments and visit photos. Shops see their balance.",
  },
  {
    device: "Tablet",
    who: "Managers",
    what: "Plan the day, issue stock, confirm cheques, count returns.",
  },
  {
    device: "Desktop",
    who: "Owners and managers",
    what: "Reports, overdue credit, low stock and expenses.",
  },
];

/** Table: which device, who uses it, what they do there. Typed, not drawn. */
export function AnyDevice() {
  return (
    <section aria-labelledby="devices-title" className="border-y border-rule bg-paper-2 py-section-s">
      <div className="container">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="devices-title" className="lg:col-span-6">Opens in the browser you already have</h2>
          <p className="lead text-ink-2 lg:col-span-5 lg:col-start-8">
            Everyone has their own login. Nothing to install.
          </p>
        </div>
        <table className="mt-16 w-full border-collapse text-left max-md:block">
          <caption className="sr-only">Devices and who uses them</caption>
          <thead className="max-md:sr-only">
            <tr className="border-b-2 border-ink text-sm text-ink-2">
              <th scope="col" className="pb-3 font-medium lg:w-1/4">Device</th>
              <th scope="col" className="pb-3 font-medium lg:w-1/4">Who uses it</th>
              <th scope="col" className="pb-3 font-medium">What they do</th>
            </tr>
          </thead>
          <tbody data-reveal="stagger" className="max-md:block">
            {rows.map((r) => (
              <tr key={r.device} className="border-b border-rule-2 align-top max-md:grid max-md:gap-1 max-md:py-4">
                <th scope="row" className="py-6 text-title font-semibold max-md:py-0">{r.device}</th>
                <td className="py-6 text-lg max-md:py-0">{r.who}</td>
                <td className="py-6 text-ink-2 max-md:py-0">{r.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
