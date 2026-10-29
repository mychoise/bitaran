import { Status } from "./SheetHeader";

const lines = [
  { label: "Cash sales recorded", rs: "18,850" },
  { label: "Cash payments on old udharo", rs: "6,600" },
  { label: "Should hand over", rs: "25,450", strong: true },
  { label: "Handed over to the manager", rs: "25,000", strong: true },
];

/** The evening cash check: what the salesman collected against what he handed over. */
export function CashCheck({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-sm rounded-stock p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Cash check</p>
        <Status pop={3}>Rs 450 short</Status>
      </div>
      <dl className="m-0 mt-4 flex flex-col text-sm">
        {lines.map((l) => (
          <div key={l.label} className={`flex justify-between gap-4 border-t py-2 ${l.strong ? "border-print font-semibold" : "border-rule"}`}>
            <dt>{l.label}</dt>
            <dd className="m-0 font-outlier">{l.rs}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Counted by the manager. His count is the one that is kept.</p>
    </div>
  );
}
