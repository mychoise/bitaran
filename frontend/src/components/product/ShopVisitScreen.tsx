import { CameraIcon, CheckIcon, PinIcon } from "@/components/ui/icons";

const history = [
  { date: "7 Kartik", what: "Noodles 4, oil 12", rs: "6,600" },
  { date: "29 Asoj", what: "Sugar 2, biscuits 3", rs: "8,600" },
];

const today = [
  { what: "Noodles, carton of 30", qty: "3", rs: "2,250" },
  { what: "Soap, dozen", qty: "2", rs: "1,560" },
];

/**
 * What the salesman sees at one shop: balance and limit, what it bought before,
 * today's sale, how it pays, and the visit photo. Shown flat, without the phone bezel.
 */
export function ShopVisitScreen({ className = "" }: { className?: string }) {
  return (
    <div className={`stock grid w-full max-w-3xl gap-0 overflow-hidden rounded-stock md:grid-cols-2 ${className}`.trim()}>
      <div className="border-rule p-6 md:border-r">
        <p className="text-xs text-muted">Shop 1 of 6</p>
        <p className="text-xl font-semibold">Example Kirana, Bagar</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-rule py-3 text-xs">
          <div>
            <dt className="text-muted">Owes</dt>
            <dd className="m-0 font-outlier text-sm">Rs 12,400</dd>
          </div>
          <div>
            <dt className="text-muted">Limit</dt>
            <dd className="m-0 font-outlier text-sm">Rs 30,000</dd>
          </div>
          <div>
            <dt className="text-muted">Due</dt>
            <dd className="m-0 text-sm">20 Kartik</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm font-medium">Bought before</p>
        <ul className="mt-2 flex list-none flex-col p-0 text-xs">
          {history.map((h) => (
            <li key={h.date} className="flex justify-between gap-3 border-b border-rule py-1.5">
              <span className="w-16 shrink-0 text-muted">{h.date}</span>
              <span className="flex-1">{h.what}</span>
              <span className="font-outlier">{h.rs}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm font-medium">Today</p>
        <ul className="mt-2 flex list-none flex-col p-0 text-xs">
          {today.map((t) => (
            <li key={t.what} className="flex justify-between gap-3 border-b border-rule py-1.5">
              <span className="flex-1">{t.what}</span>
              <span className="w-6 text-right font-outlier">{t.qty}</span>
              <span className="w-14 text-right font-outlier">{t.rs}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-paper-2 p-6">
        <p className="text-sm font-medium">Payment</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-input border border-rule-2 p-1 text-center text-xs">
          <span className="py-1.5">Cash</span>
          <span className="rounded-input bg-ink py-1.5 text-cotton">Cheque</span>
          <span className="py-1.5">Online</span>
        </div>
        <p className="mt-2 text-xs text-muted">A cheque needs a photo. It stays pending until the manager confirms it.</p>
        <p className="mt-6 text-sm font-medium">Visit photo</p>
        <div className="visit-photo mt-2 flex h-32 items-end rounded-input p-2" aria-hidden="true">
          <span className="rounded-input bg-board px-1.5 font-outlier text-xs text-board-type">14 Kartik 2083, 11:42</span>
        </div>
        <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 text-xs">
          <li className="flex items-center gap-2">
            <CameraIcon className="size-4 shrink-0" /> Taken at 11:42, stamped on the photo
          </li>
          <li className="flex items-center gap-2">
            <PinIcon className="size-4 shrink-0" /> Location matches the shop
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="size-4 shrink-0" /> Visit recorded
          </li>
        </ul>
      </div>
    </div>
  );
}
