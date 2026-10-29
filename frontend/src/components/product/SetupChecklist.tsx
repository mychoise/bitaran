import { CheckIcon } from "@/components/ui/icons";
import { SheetHeader } from "./SheetHeader";

const tasks = [
  { task: "Business created", detail: "Example Traders, Pokhara", done: true },
  { task: "Staff logins", detail: "1 owner, 2 managers, 6 salesmen", done: true },
  { task: "Products imported", detail: "240 items from your price list", done: true },
  { task: "Shops and opening balances", detail: "180 shops, udharo carried over", done: true },
  { task: "Training", detail: "Managers first, then salesmen", done: false },
];

/** An onboarding checklist for one new business, part way through. */
export function SetupChecklist({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-md rounded-stock p-6 ${className}`.trim()}>
      <SheetHeader label="Setup" title="Example Traders" aside="4 of 5 done" />
      <ol className="tick-list m-0 mt-2 flex list-none flex-col p-0">
        {tasks.map((t) => (
          <li key={t.task} className="flex items-start gap-3 border-b border-rule py-3 last:border-b-0">
            {t.done ? (
              <span className="tick mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill bg-ink text-cotton">
                <CheckIcon className="size-3.5" />
                <span className="sr-only">Done:</span>
              </span>
            ) : (
              <span className="mt-0.5 size-5 shrink-0 rounded-pill border border-ink">
                <span className="sr-only">To do:</span>
              </span>
            )}
            <span>
              <span className="block text-sm font-medium">{t.task}</span>
              <span className="block text-xs text-muted">{t.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
