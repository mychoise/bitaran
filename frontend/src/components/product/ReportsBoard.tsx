import type { ReactNode } from "react";
import { Status } from "./SheetHeader";

const bySalesman = [
  { name: "Example Salesman", route: "Bagar to Lamachaur", rs: "38,050" },
  { name: "Example Salesman 2", route: "Chipledhunga to Lakeside", rs: "41,600" },
  { name: "Example Salesman 3", route: "Prithvi Chowk to Hemja", rs: "27,300" },
];

const topProducts = [
  { item: "Noodles, carton of 30", qty: "41" },
  { item: "Mustard oil, 1 litre", qty: "96" },
  { item: "Biscuits, carton", qty: "23" },
];

const lowStock = [
  { item: "Sugar, 25 kg sack", left: "4" },
  { item: "Soap, dozen", left: "6" },
];

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="stock rounded-stock p-6">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** The owner's day at a glance, built from tables rather than charts. */
export function ReportsBoard({ className = "" }: { className?: string }) {
  return (
    <div className={`grid w-full grid-cols-1 gap-6 md:grid-cols-5 ${className}`.trim()}>
      <div className="md:col-span-3">
        <Panel title="Today's sales by salesman, Rs">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Today&apos;s sales by salesman</caption>
            <tbody>
              {bySalesman.map((s) => (
                <tr key={s.name} className="border-t border-rule">
                  <th scope="row" className="py-2 text-left font-medium">
                    {s.name}
                    <span className="block text-xs font-normal text-muted">{s.route}</span>
                  </th>
                  <td className="py-2 text-right font-outlier">{s.rs}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-print">
                <th scope="row" className="pt-2 text-left font-semibold">All shops</th>
                <td className="pt-2 text-right font-outlier font-semibold">1,06,950</td>
              </tr>
            </tfoot>
          </table>
        </Panel>
      </div>
      <div className="md:col-span-2">
        <Panel title="Overdue udharo">
          <p className="font-outlier text-2xl">Rs 33,200</p>
          <p className="mt-1 text-xs text-muted">2 shops past their due date</p>
        </Panel>
      </div>
      <div className="md:col-span-3">
        <Panel title="Top products today">
          <ol className="m-0 flex list-none flex-col p-0 text-sm">
            {topProducts.map((p) => (
              <li key={p.item} className="flex justify-between border-t border-rule py-2">
                {p.item}
                <span className="font-outlier">{p.qty}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <div className="md:col-span-2">
        <Panel title="Low stock">
          <ul className="m-0 flex list-none flex-col p-0 text-sm">
            {lowStock.map((p) => (
              <li key={p.item} className="flex items-center justify-between gap-2 border-t border-rule py-2">
                {p.item}
                <Status>{p.left} left</Status>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
