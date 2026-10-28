const route = ["Example Kirana", "Example Mart", "Example Bhandar", "Example Pasal", "Example Store", "Example Traders"];

const stock = [
  { item: "Noodles, carton of 30", qty: "20" },
  { item: "Mustard oil, 1 litre", qty: "48" },
  { item: "Sugar, 25 kg sack", qty: "6" },
  { item: "Biscuits, carton", qty: "15" },
  { item: "Soap, dozen", qty: "10" },
];

/** The manager's morning plan: one salesman, one route in order, and the stock he carries. */
export function DailyPlanSheet({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-2xl rounded-stock p-8 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-print pb-4">
        <div>
          <p className="text-xs text-muted">Daily plan, 14 Kartik 2083</p>
          <p className="text-xl font-semibold">Example Salesman</p>
        </div>
        <p className="text-sm">Route: Bagar to Lamachaur</p>
      </div>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium">Shops, in order</p>
          <ol className="mt-3 flex list-none flex-col gap-2 p-0">
            {route.map((shop, i) => (
              <li key={shop} className="flex gap-3 text-sm">
                <span className="w-4 font-outlier text-muted">{i + 1}</span>
                {shop}
              </li>
            ))}
          </ol>
        </div>
        <table className="w-full self-start border-collapse text-sm">
          <caption className="pb-3 text-left font-medium">Stock issued</caption>
          <thead>
            <tr className="border-b border-print text-left text-xs text-muted">
              <th scope="col" className="pb-1.5 font-medium">Item</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.item} className="border-b border-rule">
                <td className="py-2">{s.item}</td>
                <td className="py-2 text-right font-outlier">{s.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
