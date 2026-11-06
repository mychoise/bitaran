import { SheetHeader } from "./SheetHeader";

const shops = [
  { shop: "Example Bhandar", bought: "65,000", paid: "40,000", balance: "25,000" },
  { shop: "Example Store", bought: "18,200", paid: "10,000", balance: "8,200" },
  { shop: "Example Kirana", bought: "32,400", paid: "20,000", balance: "12,400" },
  { shop: "Example Traders", bought: "9,600", paid: "8,000", balance: "1,600" },
];

/** Udharo by shop: bought, paid and the balance, plus a payment put against one invoice. */
export function CreditLedger({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-3xl ${className}`.trim()}>
      <div className="stock rounded-stock p-8">
        <SheetHeader label="Udharo, 14 Kartik 2083" title="What each shop owes" aside="Amounts in Rs" />
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-120 border-collapse text-sm">
            <caption className="sr-only">What each shop bought, paid and still owes</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="py-2 font-medium">Shop</th>
                <th scope="col" className="py-2 text-right font-medium">Bought</th>
                <th scope="col" className="py-2 text-right font-medium">Paid</th>
                <th scope="col" className="py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.shop} className="border-t border-rule">
                  <th scope="row" className="py-2.5 pl-1 text-left font-medium">{s.shop}</th>
                  <td className="py-2.5 text-right font-outlier">{s.bought}</td>
                  <td className="py-2.5 text-right font-outlier">{s.paid}</td>
                  <td className="py-2.5 pr-1 text-right font-outlier">{s.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div role="note" data-pop="5" className="stock mt-6 max-w-md rounded-stock p-5 sm:ml-auto">
        <p className="text-sm font-semibold">Payment against invoice 112</p>
        <p className="mt-2 text-xs">
          Example Store pays Rs 4,000 against invoice 112 of Rs 8,100. Rs 4,100 is still unpaid on it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-input bg-ink px-3 py-1.5 text-cotton">What they bought ▾</span>
          <span className="rounded-input border border-print px-3 py-1.5">The overall balance</span>
        </div>
      </div>
    </div>
  );
}
