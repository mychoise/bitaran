import { SheetHeader, Status } from "./SheetHeader";

const shops = [
  { shop: "Example Bhandar", limit: "40,000", balance: "25,000", due: "5 Kartik", overdue: "9 days" },
  { shop: "Example Store", limit: "10,000", balance: "8,200", due: "10 Kartik", overdue: "4 days" },
  { shop: "Example Kirana", limit: "30,000", balance: "12,400", due: "20 Kartik", overdue: "" },
  { shop: "Example Traders", limit: "15,000", balance: "1,600", due: "28 Kartik", overdue: "" },
];

/** Udharo by shop: limit, balance, due date and overdue, plus a sale blocked at the limit. */
export function CreditLedger({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-3xl ${className}`.trim()}>
      <div className="stock rounded-stock p-8">
        <SheetHeader label="Udharo, 14 Kartik 2083" title="Shops by amount overdue" aside="Amounts in Rs" />
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-120 border-collapse text-sm">
            <caption className="sr-only">Credit limit, balance and due date for each shop</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">Shop</th>
                <th scope="col" className="py-2 text-right font-medium">Limit</th>
                <th scope="col" className="py-2 text-right font-medium">Balance</th>
                <th scope="col" className="py-2 text-right font-medium">Due</th>
                <th scope="col" className="py-2 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s, i) => (
                <tr key={s.shop} className={`border-t border-rule ${s.overdue ? "bg-paper-2" : ""}`}>
                  <th scope="row" className="py-2.5 pl-1 text-left font-medium">{s.shop}</th>
                  <td className="py-2.5 text-right font-outlier">{s.limit}</td>
                  <td className="py-2.5 text-right font-outlier">{s.balance}</td>
                  <td className="py-2.5 text-right">{s.due}</td>
                  <td className="py-2.5 pr-1 text-right">{s.overdue ? <Status pop={i + 1}>{s.overdue}</Status> : <span className="text-muted">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div role="note" data-pop="5" className="stock mt-6 max-w-md rounded-stock p-5 sm:ml-auto">
        <p className="text-sm font-semibold">Sale blocked: over the credit limit</p>
        <p className="mt-2 text-xs">
          Example Store owes Rs 8,200 of its Rs 10,000 limit. Today&apos;s sale of Rs 4,100 would take it to Rs 12,300.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-input bg-ink px-3 py-1.5 text-cotton">Ask a manager to allow</span>
          <span className="rounded-input border border-print px-3 py-1.5">Reduce the sale</span>
        </div>
      </div>
    </div>
  );
}
