import { CheckIcon } from "@/components/ui/icons";
import { PhoneScreen, ScreenBar } from "./PhoneScreen";

type Stop = { shop: string; place: string; owes: string; visited: boolean };

const stops: Stop[] = [
  { shop: "Example Kirana", place: "Bagar", owes: "12,400", visited: true },
  { shop: "Example Mart", place: "Bagar", owes: "0", visited: true },
  { shop: "Example Bhandar", place: "Mahendrapul", owes: "25,000", visited: true },
  { shop: "Example Pasal", place: "Prithvi Chowk", owes: "4,850", visited: true },
  { shop: "Example Store", place: "Bindabasini", owes: "8,200", visited: false },
  { shop: "Example Traders", place: "Lamachaur", owes: "1,600", visited: false },
];

/** Salesman's phone: today's route, shops in visiting order, what each owes, and a visited tick. */
export function RouteScreen({ className = "" }: { className?: string }) {
  const done = stops.filter((s) => s.visited).length;
  return (
    <PhoneScreen className={className}>
      <ScreenBar title="Today's route" aside="Example Salesman" />
      <div className="px-4 pt-3 pb-3">
        <p className="text-lg leading-tight font-semibold">Bagar to Lamachaur</p>
        <p className="mt-1 text-xs text-muted">
          {done} of {stops.length} shops visited
        </p>
      </div>
      <div className="flex justify-between border-t border-rule px-4 pt-2 pb-1 text-xs text-muted">
        <span>Shop</span>
        <span>Owes, Rs</span>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {stops.map((s, i) => (
          <li
            key={s.shop}
            className={`flex items-center gap-2.5 border-t border-rule px-4 py-2 ${s.visited ? "" : "bg-paper-2"}`}
          >
            <span className="w-3 shrink-0 font-outlier text-xs text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.shop}</span>
              <span className="block truncate text-xs text-muted">{s.place}</span>
            </span>
            <span className="shrink-0 font-outlier text-xs">{s.owes}</span>
            {s.visited ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-ink text-cotton">
                <CheckIcon className="size-3.5" />
                <span className="sr-only">Visited</span>
              </span>
            ) : (
              <span className="size-5 shrink-0 rounded-pill border border-ink">
                <span className="sr-only">{i === done ? "Next" : "Not yet visited"}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-auto border-t border-rule p-3">
        <span className="flex h-10 items-center justify-center rounded-input bg-ink text-sm font-medium text-cotton">
          Next: Example Store
        </span>
      </div>
    </PhoneScreen>
  );
}
