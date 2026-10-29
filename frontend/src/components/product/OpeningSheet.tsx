import { SheetHeader } from "./SheetHeader";

const balances = [
  { shop: "Example Kirana", rs: "9,800" },
  { shop: "Example Bhandar", rs: "25,000" },
  { shop: "Example Store", rs: "4,100" },
  { shop: "Example Traders", rs: "0" },
];

const stock = [
  { item: "Noodles, carton of 30", qty: "120" },
  { item: "Mustard oil, 1 litre", qty: "300" },
  { item: "Sugar, 25 kg sack", qty: "40" },
];

/** Step two: udharo carried over from before, and the stock in the store on the first day. */
export function OpeningSheet({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-md rounded-stock p-7 ${className}`.trim()}>
      <SheetHeader label="Opening, 1 Kartik 2083" title="What you start with" />
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="pb-1 text-left text-xs text-muted">Udharo carried over, Rs</caption>
        <tbody>
          {balances.map((b) => (
            <tr key={b.shop} className="border-t border-rule">
              <th scope="row" className="py-2 text-left font-normal">{b.shop}</th>
              <td className="py-2 text-right font-outlier">{b.rs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mt-6 w-full border-collapse text-sm">
        <caption className="pb-1 text-left text-xs text-muted">Starting stock in the store</caption>
        <tbody>
          {stock.map((s) => (
            <tr key={s.item} className="border-t border-rule">
              <th scope="row" className="py-2 text-left font-normal">{s.item}</th>
              <td className="py-2 text-right font-outlier">{s.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
