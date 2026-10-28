type Line = { item: string; qty: string; amount: string };

const lines: Line[] = [
  { item: "Noodles, carton of 30", qty: "5", amount: "3,750" },
  { item: "Mustard oil, 1 litre", qty: "12", amount: "3,600" },
  { item: "Sugar, 25 kg sack", qty: "1", amount: "2,500" },
  { item: "Biscuits, carton", qty: "2", amount: "2,400" },
];

/** A sale's invoice on a cotton sheet, with its sequential number and the pressed "Paid" mark. */
export function Invoice({ className = "", paid = true }: { className?: string; paid?: boolean }) {
  return (
    <div className={`stock relative w-72 rounded-stock p-5 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Invoice</p>
          <p className="font-outlier text-lg">No. 00218</p>
        </div>
        <p className="text-right text-xs text-muted">
          14 Kartik 2083
          <br />
          Example Mart, Bagar
        </p>
      </div>
      <table className="mt-5 w-full border-collapse text-xs">
        <caption className="sr-only">Invoice lines</caption>
        <thead>
          <tr className="border-b border-print text-left text-muted">
            <th scope="col" className="pb-1.5 font-medium">Item</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Qty</th>
            <th scope="col" className="pb-1.5 text-right font-medium">Rs</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.item} className="border-b border-rule">
              <td className="py-1.5 pr-2">{l.item}</td>
              <td className="py-1.5 text-right font-outlier">{l.qty}</td>
              <td className="py-1.5 text-right font-outlier">{l.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className="pt-2 text-left font-semibold">Total</th>
            <td className="pt-2 text-right font-outlier font-semibold">12,250</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-4 text-xs text-muted">Cash, collected by Example Salesman</p>
      {paid ? (
        <span className="pressed absolute bottom-11 left-24 text-3xl">Paid</span>
      ) : null}
    </div>
  );
}
