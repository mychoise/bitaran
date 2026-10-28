type Row = { item: string; issued: number; sold: number; returned: number };

const rows: Row[] = [
  { item: "Noodles, carton of 30", issued: 20, sold: 14, returned: 6 },
  { item: "Mustard oil, 1 litre", issued: 48, sold: 36, returned: 11 },
  { item: "Sugar, 25 kg sack", issued: 6, sold: 4, returned: 2 },
  { item: "Biscuits, carton", issued: 15, sold: 9, returned: 6 },
  { item: "Soap, dozen", issued: 10, sold: 7, returned: 3 },
];

/** The manager's evening count: issued, sold, returned, and the shortage worked out for each item. */
export function ReconcileSheet({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-3xl rounded-stock p-8 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-muted">End of day, 14 Kartik 2083</p>
          <p className="text-xl font-semibold">Example Salesman, Bagar to Lamachaur</p>
        </div>
        <p className="text-sm text-muted">Counted by the manager at 19:40</p>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-120 border-collapse text-sm">
          <caption className="sr-only">Stock issued, sold and returned, with shortage</caption>
          <thead>
            <tr className="border-b border-print text-left text-xs text-muted">
              <th scope="col" className="pb-2 font-medium">Item</th>
              <th scope="col" className="pb-2 text-right font-medium">Issued</th>
              <th scope="col" className="pb-2 text-right font-medium">Sold</th>
              <th scope="col" className="pb-2 text-right font-medium">Returned</th>
              <th scope="col" className="pb-2 text-right font-medium">Shortage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const short = r.issued - r.sold - r.returned;
              return (
                <tr key={r.item} className={`border-b border-rule ${short > 0 ? "bg-paper-2" : ""}`}>
                  <th scope="row" className="py-2.5 pl-1 text-left font-medium">{r.item}</th>
                  <td className="py-2.5 text-right font-outlier">{r.issued}</td>
                  <td className="py-2.5 text-right font-outlier">{r.sold}</td>
                  <td className="py-2.5 text-right font-outlier">{r.returned}</td>
                  <td className="py-2.5 pr-1 text-right">
                    {short > 0 ? (
                      <span className="rounded-input border border-print px-2 font-outlier font-semibold">{short} short</span>
                    ) : (
                      <span className="font-outlier text-muted">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm">One bottle of mustard oil is missing. It shows here before anyone goes home.</p>
    </div>
  );
}
