const facts = [
  { label: "Shop", value: "Example Bhandar", mono: false },
  { label: "Amount", value: "Rs 25,000", mono: true },
  { label: "Cheque no.", value: "000417", mono: true },
];

/** A cheque payment on an index card: the photo of the cheque, the amount, and the "Pending" badge. */
export function ChequeCard({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-64 rounded-stock p-5 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Cheque payment</p>
        <span className="rounded-input border border-print px-2 text-xs font-medium">Pending</span>
      </div>
      <div className="mt-4 flex gap-4">
        {/* Thumbnail of the cheque photo the salesman took. */}
        <div className="cheque-thumb flex h-16 w-24 shrink-0 flex-col justify-between rounded-input p-2" aria-hidden="true">
          <span className="h-1 w-10 rounded-pill bg-rule-2" />
          <span className="h-1 w-16 rounded-pill bg-rule-2" />
          <span className="flex justify-between">
            <span className="h-1 w-8 rounded-pill bg-rule-2" />
            <span className="h-1 w-5 rounded-pill bg-rule-2" />
          </span>
        </div>
        <dl className="m-0 flex min-w-0 flex-1 flex-col gap-1 text-xs">
          {facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-2">
              <dt className="text-muted">{f.label}</dt>
              <dd className={`m-0 truncate ${f.mono ? "font-outlier" : ""}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 text-xs text-muted">Photo attached. Waiting for the manager to confirm.</p>
    </div>
  );
}
