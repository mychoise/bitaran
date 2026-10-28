import { SheetHeader, Status } from "./SheetHeader";

type Payment = {
  shop: string;
  kind: string;
  proof: string;
  rs: string;
  status: { label: string; tone: "open" | "done" | "stop" };
  effect: string;
};

const payments: Payment[] = [
  { shop: "Example Kirana", kind: "Cash", proof: "None needed", rs: "6,600", status: { label: "Received", tone: "done" }, effect: "Balance reduced" },
  { shop: "Example Bhandar", kind: "Cheque 000417", proof: "Cheque photo", rs: "25,000", status: { label: "Pending", tone: "open" }, effect: "Waiting for manager" },
  { shop: "Example Mart", kind: "Online", proof: "Screenshot", rs: "12,250", status: { label: "Confirmed", tone: "done" }, effect: "Balance reduced" },
  { shop: "Example Pasal", kind: "Online", proof: "Screenshot used before", rs: "4,350", status: { label: "Rejected", tone: "stop" }, effect: "Not counted" },
  { shop: "Example Store", kind: "Cheque 000388", proof: "Cheque photo", rs: "8,200", status: { label: "Bounced", tone: "stop" }, effect: "Shop still owes it" },
];

/** Payments waiting for the manager: proof, status, and what each did to the shop's balance. */
export function PaymentsQueue({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-3xl rounded-stock p-8 ${className}`.trim()}>
      <SheetHeader label="Payments, 14 Kartik 2083" title="Collected by Example Salesman" aside="Amounts in Rs" />
      <div className="overflow-x-auto">
        <table className="mt-3 w-full min-w-150 border-collapse text-sm">
          <caption className="sr-only">Payments with their proof and status</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-2 font-medium">Shop</th>
              <th scope="col" className="py-2 font-medium">How</th>
              <th scope="col" className="py-2 font-medium">Proof</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
              <th scope="col" className="py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.shop} className="border-t border-rule align-top">
                <th scope="row" className="py-2.5 pl-1 text-left font-medium">{p.shop}</th>
                <td className="py-2.5">{p.kind}</td>
                <td className="py-2.5 text-xs">{p.proof}</td>
                <td className="py-2.5 text-right font-outlier">{p.rs}</td>
                <td className="py-2.5 pr-1 text-right">
                  <Status tone={p.status.tone}>{p.status.label}</Status>
                  <span className="mt-1 block text-xs text-muted">{p.effect}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
