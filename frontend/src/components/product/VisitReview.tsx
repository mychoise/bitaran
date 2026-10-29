import { CameraIcon, PinIcon } from "@/components/ui/icons";
import { SheetHeader, Status } from "./SheetHeader";

type Visit = {
  shop: string;
  stamp: string;
  distance: string;
  status: { label: string; tone: "open" | "done" | "stop" };
  note: string;
};

const visits: Visit[] = [
  { shop: "Example Kirana", stamp: "11:42", distance: "15 m from shop", status: { label: "OK", tone: "done" }, note: "Taken at the shop, today." },
  { shop: "Example Mart", stamp: "12:05", distance: "20 m from shop", status: { label: "OK", tone: "done" }, note: "Taken at the shop, today." },
  { shop: "Example Pasal", stamp: "12:31", distance: "1.4 km from shop", status: { label: "Flagged", tone: "open" }, note: "Location does not match the shop." },
  { shop: "Example Store", stamp: "13:10", distance: "At the shop", status: { label: "Rejected", tone: "stop" }, note: "This photo was already uploaded on 7 Kartik." },
];

/** The manager's review of today's visit photos, with location checks and flags. */
export function VisitReview({ className = "" }: { className?: string }) {
  return (
    <div className={`stock w-full max-w-3xl rounded-stock p-8 ${className}`.trim()}>
      <SheetHeader label="Visit photos, 14 Kartik 2083" title="Example Salesman" aside="2 need a look" />
      <ul className="m-0 mt-2 flex list-none flex-col p-0">
        {visits.map((v, i) => (
          <li key={v.shop} className="grid grid-cols-1 gap-4 border-b border-rule py-4 sm:grid-cols-6 sm:items-center">
            <div className="visit-photo flex h-16 items-end rounded-input p-1.5 sm:col-span-1" aria-hidden="true">
              <span className="rounded-input bg-board px-1 font-outlier text-xs text-board-type">{v.stamp}</span>
            </div>
            <div className="sm:col-span-3">
              <p className="text-sm font-medium">{v.shop}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <CameraIcon className="size-4" /> Stamped {v.stamp}
                </span>
                <span className="inline-flex items-center gap-1">
                  <PinIcon className="size-4" /> {v.distance}
                </span>
              </p>
              <p className="mt-1 text-xs">{v.note}</p>
            </div>
            <div className="sm:col-span-2 sm:text-right">
              <Status tone={v.status.tone} pop={i + 1}>{v.status.label}</Status>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
