import { SheetHeader } from "./SheetHeader";

const rows = [
  { who: "Example Salesman", kind: "Fuel", rs: "450", bill: true },
  { who: "Example Salesman", kind: "Khaja", rs: "180", bill: false },
  { who: "Example Driver", kind: "Fuel", rs: "1,200", bill: true },
  { who: "Example Manager", kind: "Miscellaneous", rs: "300", bill: true },
  { who: "Example Salesman", kind: "Salary, Kartik", rs: "18,000", bill: false },
];

/** One day's expenses, by person and type, with a mark where a bill photo is attached. */
export function ExpenseSheet({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-xl rounded-stock p-8 ${className}`.trim()}>
      <SheetHeader label="Expenses" title="14 Kartik 2083" aside="Amounts in Rs" />
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">Expenses by person</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-2 font-medium">Person</th>
            <th scope="col" className="py-2 font-medium">Type</th>
            <th scope="col" className="py-2 text-right font-medium">Rs</th>
            <th scope="col" className="py-2 text-right font-medium">Bill</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-rule">
              <th scope="row" className="py-2.5 text-left font-normal">{r.who}</th>
              <td className="py-2.5">{r.kind}</td>
              <td className="py-2.5 text-right font-outlier">{r.rs}</td>
              <td className="py-2.5 text-right text-xs">{r.bill ? "Photo" : <span className="text-muted">None</span>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-print">
            <th scope="row" colSpan={2} className="pt-2.5 text-left font-semibold">Total</th>
            <td className="pt-2.5 text-right font-outlier font-semibold">20,130</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
