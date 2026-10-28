import { PhoneScreen, ScreenBar } from "./PhoneScreen";

const entries = [
  { date: "29 Asoj", what: "Invoice 00171", rs: "+8,600" },
  { date: "2 Kartik", what: "Cash payment", rs: "−5,000" },
  { date: "7 Kartik", what: "Invoice 00196", rs: "+6,600" },
  { date: "9 Kartik", what: "Return, biscuits", rs: "−1,200" },
  { date: "11 Kartik", what: "Invoice 00209", rs: "+3,400" },
  { date: "12 Kartik", what: "Cheque 000402", rs: "Pending" },
];

/** What a shop sees when it logs in: its balance, limit, due date and statement. Nothing else. */
export function ShopStatementScreen({ className = "" }: { className?: string }) {
  return (
    <PhoneScreen className={className}>
      <ScreenBar title="My account" aside="Example Kirana" />
      <div className="border-b border-rule px-4 py-4">
        <p className="text-xs text-muted">You owe</p>
        <p className="font-outlier text-2xl">Rs 12,400</p>
        <p className="mt-1 text-xs text-muted">Limit Rs 30,000. Due 20 Kartik.</p>
      </div>
      <p className="px-4 pt-3 pb-1 text-sm font-medium">Statement</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {entries.map((e) => (
          <li key={e.date + e.what} className="flex items-baseline gap-3 border-t border-rule px-4 py-2 text-xs">
            <span className="w-14 shrink-0 text-muted">{e.date}</span>
            <span className="flex-1">{e.what}</span>
            <span className="font-outlier">{e.rs}</span>
          </li>
        ))}
      </ul>
    </PhoneScreen>
  );
}
