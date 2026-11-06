"use client";

// "What they bought": a dropdown under any invoice that lists its items. When the list
// already carries the lines (the demo data does) they show at once; otherwise they are
// fetched as soon as the pointer or keyboard reaches the dropdown, so opening it is instant.

import { useState } from "react";
import { MoneyText } from "@/components/ui/Display";
import { useApiQuery } from "@/lib/api/provider";
import type { SaleLine } from "@/lib/api/types";
import { countUnits } from "@/lib/units";

type Row = { key: string; name: string; quantity: string; pricePaisa: number; totalPaisa: number };

const quantityText = (unit: "unit" | "carton", quantity: number, unitName: string) =>
  unit === "carton" ? `${quantity} carton${quantity === 1 ? "" : "s"}` : countUnits(quantity, unitName);

export function InvoiceItems({
  saleId,
  lines,
  source = "staff",
  label = "What they bought",
  className = "",
}: {
  saleId: string;
  /** The invoice's lines, when the list already has them. */
  lines?: SaleLine[];
  /** "shop" reads the shop's own invoice call; staff read the sale. */
  source?: "staff" | "shop";
  label?: string;
  className?: string;
}) {
  const [want, setWant] = useState(false);
  const have = Boolean(lines?.length);
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }), { enabled: want && source === "staff", staleTime: 5 * 60_000 });
  const sale = useApiQuery(["sales", "detail", saleId], (api) => api.sales.get(saleId), { enabled: want && source === "staff" && !have, staleTime: 60_000 });
  const invoice = useApiQuery(["shopPortal", "invoice", saleId], (api) => api.shopPortal.invoice(saleId), { enabled: want && source === "shop", staleTime: 60_000 });

  const product = (id: string) => products.data?.items.find((p) => p.id === id);
  let rows: Row[] | null = null;
  let discount = 0;
  if (source === "shop" && invoice.data) {
    rows = invoice.data.lines.map((l, i) => ({ key: String(i), name: l.productName, quantity: quantityText(l.unit, l.quantity, l.unitName), pricePaisa: l.pricePaisa, totalPaisa: l.totalPaisa }));
    discount = invoice.data.discountPaisa;
  } else if (source === "staff" && (have || sale.data) && (products.data || products.isError)) {
    const ls = have ? lines! : sale.data!.lines;
    rows = ls.map((l) => ({ key: `${l.productId}-${l.unit}`, name: product(l.productId)?.name ?? "A product", quantity: quantityText(l.unit, l.quantity, product(l.productId)?.unitName ?? "unit"), pricePaisa: l.pricePaisa, totalPaisa: l.totalPaisa }));
    discount = sale.data?.discountPaisa ?? 0;
  }
  const failed = source === "shop" ? invoice.isError : sale.isError;
  const retry = () => (source === "shop" ? invoice.refetch() : sale.refetch());

  return (
    <details className={`invoice-items ${className}`.trim()} onToggle={(e) => e.currentTarget.open && setWant(true)}>
      <summary className="cursor-pointer text-sm text-link whitespace-nowrap" onPointerEnter={() => setWant(true)} onFocus={() => setWant(true)}>
        {label}
      </summary>
      <div className="reveal-down">
        {rows ? (
          <ul className="m-0 mt-2 min-w-56 list-none rounded-input border border-rule-2 p-0 text-sm">
            {rows.map((r) => (
              <li key={r.key} className="flex justify-between gap-3 border-t border-rule-2 px-3 py-2 first:border-t-0">
                <span>
                  {r.name}
                  <span className="block text-muted">
                    {r.quantity} at <MoneyText paisa={r.pricePaisa} />
                  </span>
                </span>
                <MoneyText paisa={r.totalPaisa} />
              </li>
            ))}
            {discount ? (
              <li className="flex justify-between gap-3 border-t border-rule-2 px-3 py-2">
                <span>Discount</span>
                <MoneyText paisa={-discount} />
              </li>
            ) : null}
          </ul>
        ) : failed ? (
          <p className="mt-2 text-sm text-ink-2">
            The items did not load.{" "}
            <button type="button" className="text-link" onClick={retry}>
              Try again
            </button>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Loading the items…</p>
        )}
      </div>
    </details>
  );
}
