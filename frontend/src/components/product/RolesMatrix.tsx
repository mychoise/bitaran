import { CheckIcon } from "@/components/ui/icons";

type Access = "yes" | "own" | "no";

const roles = ["Owner", "Manager", "Salesman", "Shop"] as const;

const rows: { what: string; access: Access[] }[] = [
  { what: "Sales and invoices", access: ["yes", "yes", "own", "own"] },
  { what: "Udharo and balances", access: ["yes", "yes", "own", "own"] },
  { what: "Confirm cheques and online payments", access: ["yes", "yes", "no", "no"] },
  { what: "Stock count and shortages", access: ["yes", "yes", "own", "no"] },
  { what: "Reports", access: ["yes", "yes", "own", "no"] },
  { what: "Cost prices", access: ["yes", "yes", "no", "no"] },
];

function Cell({ a }: { a: Access }) {
  if (a === "yes")
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-pill bg-ink text-cotton">
        <CheckIcon className="size-4" />
        <span className="sr-only">Yes</span>
      </span>
    );
  if (a === "own") return <span className="text-xs">Own only</span>;
  return (
    <span className="text-muted" aria-label="No">
      No
    </span>
  );
}

/** Who sees what. "Own only" means a salesman's own work, or a shop's own account. */
export function RolesMatrix({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-3xl rounded-stock p-8 ${className}`.trim()}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-130 border-collapse text-sm">
          <caption className="pb-4 text-left text-xl font-semibold">Who sees what</caption>
          <thead>
            <tr className="border-b border-print text-xs text-muted">
              <th scope="col" className="py-2 text-left font-medium">Part of the system</th>
              {roles.map((r) => (
                <th key={r} scope="col" className="py-2 text-center font-medium">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.what} className="border-b border-rule">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">{row.what}</th>
                {row.access.map((a, i) => (
                  <td key={roles[i]} className="py-2.5 text-center">
                    <Cell a={a} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
