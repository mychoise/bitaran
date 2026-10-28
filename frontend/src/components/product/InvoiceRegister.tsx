import { SheetHeader, Status } from "./SheetHeader";

const rows = [
  { no: "00214", shop: "Example Kirana", rs: "6,600", state: "Paid" },
  { no: "00215", shop: "Example Bhandar", rs: "9,200", state: "Udharo" },
  { no: "00216", shop: "Example Pasal", rs: "4,850", state: "Cancelled" },
  { no: "00217", shop: "Example Pasal", rs: "4,350", state: "Udharo" },
  { no: "00218", shop: "Example Mart", rs: "12,250", state: "Paid" },
];

/** The invoice list: sequential numbers, with a cancelled sale keeping its number. */
export function InvoiceRegister({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-md rounded-stock p-6 ${className}`.trim()}>
      <SheetHeader label="Invoices, 14 Kartik 2083" title="00214 to 00218" />
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">Invoices in number order</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1.5 font-medium">No.</th>
            <th scope="col" className="py-1.5 font-medium">Shop</th>
            <th scope="col" className="py-1.5 text-right font-medium">Rs</th>
            <th scope="col" className="py-1.5 text-right font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no} className="border-t border-rule">
              <th scope="row" className="py-2 text-left font-outlier font-normal">{r.no}</th>
              <td className={`py-2 ${r.state === "Cancelled" ? "text-muted line-through" : ""}`}>{r.shop}</td>
              <td className={`py-2 text-right font-outlier ${r.state === "Cancelled" ? "text-muted line-through" : ""}`}>{r.rs}</td>
              <td className="py-2 text-right">
                {r.state === "Cancelled" ? <Status tone="stop">Cancelled</Status> : <span className="text-xs">{r.state}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted">00216 was cancelled. It keeps its number, so the list has no gap.</p>
    </div>
  );
}
