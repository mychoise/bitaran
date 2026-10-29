import { SheetHeader, Status } from "./SheetHeader";

const returns = [
  { from: "Example Kirana", item: "Biscuits, carton", qty: "1", reason: "Expired", credit: "1,200" },
  { from: "Example Traders", item: "Mustard oil, 1 litre", qty: "2", reason: "Damaged", credit: "600" },
  { from: "Own stock", item: "Sugar, 25 kg sack", qty: "1", reason: "Damaged, wet in store", credit: "" },
];

/** Shop returns credited to the shop, own-stock write-offs, all kept out of sellable stock. */
export function ReturnsSheet({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-3xl rounded-stock p-8 ${className}`.trim()}>
      <SheetHeader label="Returns and write-offs" title="14 Kartik 2083" aside="Amounts in Rs" />
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-130 border-collapse text-sm">
          <caption className="sr-only">Returned and written-off goods with reasons</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-2 font-medium">From</th>
              <th scope="col" className="py-2 font-medium">Item</th>
              <th scope="col" className="py-2 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pl-4 font-medium">Reason</th>
              <th scope="col" className="py-2 text-right font-medium">Credited to shop</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r, i) => (
              <tr key={r.from + r.item} className="border-t border-rule">
                <th scope="row" className="py-2.5 pl-1 text-left font-medium">{r.from}</th>
                <td className="py-2.5">{r.item}</td>
                <td className="py-2.5 text-right font-outlier">{r.qty}</td>
                <td className="py-2.5 pl-4"><Status pop={i + 1}>{r.reason}</Status></td>
                <td className="py-2.5 pr-1 text-right font-outlier">{r.credit || <span className="font-body text-xs text-muted">Written off</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm">None of these go back into sellable stock.</p>
    </div>
  );
}
