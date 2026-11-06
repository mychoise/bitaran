"use client";

// A sale at one shop, in three screens. Pick: products you carry, with search, category chips,
// big rows with a piece or carton toggle and a stepper that stops at what you have left, and a
// bar with the running total. Review: the items, a discount, the due date for credit, cash paid
// now, and the credit check in plain words. Done: the invoice, to print or share.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Card, MoneyText } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { checkCreditLimit, checkDueDate, priceLine, saleMoney } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Product, Sale, SaleUnit, VisitShop } from "@/lib/api/types";
import { addDays, formatDate, formatDateTime, todayNepal } from "@/lib/dates";
import { formatAmount, formatMoney, parseRupees } from "@/lib/money";
import { cartonEquivalent, countUnits, plural } from "@/lib/units";
import { useOnceKey, useSingleFlight, VisitGate } from "./onVisit";
import { DAY_AFFECTS } from "./useToday";

type CartLine = { unit: SaleUnit; quantity: number };

export function NewSale() {
  return <VisitGate title="New sale">{(v) => <SaleFlow v={v} />}</VisitGate>;
}

function SaleFlow({ v }: { v: VisitShop }) {
  const report = useApiQuery(["dayPlans", "report", v.planId], (api) => api.dayPlans.report(v.planId));
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const categories = useApiQuery(["categories", "list"], (api) => api.categories.list());
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [stage, setStage] = useState<"pick" | "review">("pick");
  const [sale, setSale] = useState<Sale | null>(null);

  const carried = useMemo(() => new Map((report.data?.stock ?? []).map((l) => [l.productId, l.remaining])), [report.data]);
  const list = useMemo(() => (products.data?.items ?? []).filter((p) => carried.has(p.id) && p.active), [products.data, carried]);
  if (report.isPending || products.isPending) return <LoadingState label="Loading what you carry" />;
  if (report.isError) return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  if (products.isError) return <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />;

  const lines = Object.entries(cart)
    .filter(([, l]) => l.quantity > 0)
    .map(([productId, l]) => ({ product: list.find((p) => p.id === productId)!, ...l }))
    .filter((l) => l.product);
  const priced = lines.map((l) => priceLine(l.product, l.quantity, l.unit));
  const subtotal = priced.reduce((a, l) => a + l.totalPaisa, 0);

  if (sale) return <Invoice sale={sale} v={v} products={list} />;
  if (stage === "review") return <Review v={v} lines={lines} onBack={() => setStage("pick")} onDone={setSale} />;
  return <Picker list={list} carried={carried} cart={cart} setCart={setCart} categories={categories.data ?? []} subtotal={subtotal} count={lines.length} onNext={() => setStage("review")} />;
}

// ---- pick --------------------------------------------------------------------------------------

function Picker({
  list,
  carried,
  cart,
  setCart,
  categories,
  subtotal,
  count,
  onNext,
}: {
  list: Product[];
  carried: Map<string, number>;
  cart: Record<string, CartLine>;
  setCart: (c: Record<string, CartLine>) => void;
  categories: { id: string; name: string }[];
  subtotal: number;
  count: number;
  onNext: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const term = search.trim().toLowerCase();
  const shown = list.filter((p) => (!category || p.categoryId === category) && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)));
  const used = categories.filter((c) => list.some((p) => p.categoryId === c.id));

  return (
    <>
      <Input label="Find a product" type="search" placeholder="Name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="-mt-2 mb-4 flex flex-wrap gap-2" role="group" aria-label="Categories">
        {[{ id: "", name: "All" }, ...used].map((c) => (
          <Button key={c.id || "all"} variant={category === c.id ? "primary" : "secondary"} size="sm" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </Button>
        ))}
      </div>
      {list.length === 0 ? <p className="text-ink-2">You carry nothing to sell today.</p> : shown.length === 0 ? <p className="text-ink-2">No product you carry matches.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {shown.map((p) => (
          <li key={p.id}>
            <ProductRow p={p} left={carried.get(p.id) ?? 0} line={cart[p.id] ?? { unit: "unit", quantity: 0 }} onChange={(l) => setCart({ ...cart, [p.id]: l })} />
          </li>
        ))}
      </ul>
      <div className="sticky bottom-20 z-10 mt-6 lg:bottom-4">
        <Card dense className="flex items-center gap-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-muted">
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="block text-xl" aria-live="polite">
              <MoneyText paisa={subtotal} />
            </span>
          </span>
          <Button size="lg" disabled={count === 0} onClick={onNext}>
            Review sale
          </Button>
        </Card>
      </div>
    </>
  );
}

function ProductRow({ p, left, line, onChange }: { p: Product; left: number; line: CartLine; onChange: (l: CartLine) => void }) {
  const size = line.unit === "carton" ? (p.unitsPerCarton ?? 1) : 1;
  const max = Math.floor(left / size);
  const set = (quantity: number) => onChange({ ...line, quantity: Math.max(0, Math.min(max, quantity)) });
  const price = line.unit === "carton" ? p.cartonPricePaisa! : p.unitPricePaisa;
  return (
    <Card dense className={line.quantity > 0 ? "ring-2 ring-ink" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium">{p.name}</p>
          <p className="text-sm text-ink-2">
            <MoneyText paisa={p.unitPricePaisa} /> a {p.unitName}
            {p.cartonPricePaisa !== null ? (
              <>
                {" · "}
                <MoneyText paisa={p.cartonPricePaisa} /> a carton of {p.unitsPerCarton}
              </>
            ) : null}
          </p>
          <p className="text-sm text-muted">
            Left with you: {countUnits(left, p.unitName)}
            {cartonEquivalent(left, p.unitsPerCarton, p.unitName) ? ` (${cartonEquivalent(left, p.unitsPerCarton, p.unitName)})` : ""}
          </p>
        </div>
        {p.unitsPerCarton ? (
          <Segmented
            label={`Sell ${p.name} by`}
            value={line.unit}
            onChange={(unit) => onChange({ unit, quantity: Math.min(line.quantity, Math.floor(left / (unit === "carton" ? p.unitsPerCarton! : 1))) })}
            options={[
              { value: "unit", label: capital(plural(p.unitName)) },
              { value: "carton", label: "Cartons" },
            ]}
          />
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" size="lg" className="w-14 px-0" aria-label={`One fewer ${p.name}`} disabled={line.quantity === 0} onClick={() => set(line.quantity - 1)}>
          <MinusIcon className="size-6" />
        </Button>
        <span className="w-12 text-center font-outlier text-2xl" aria-live="polite" aria-label={`${line.quantity} ${line.unit === "carton" ? "cartons" : plural(p.unitName)} of ${p.name}`}>
          {line.quantity}
        </span>
        <Button variant="secondary" size="lg" className="w-14 px-0" aria-label={`One more ${p.name}`} disabled={line.quantity >= max} onClick={() => set(line.quantity + 1)}>
          <PlusIcon className="size-6" />
        </Button>
        <span className="ml-auto text-right">
          {line.quantity > 0 ? <MoneyText paisa={price * line.quantity} className="text-lg" /> : null}
          {line.quantity >= max && max > 0 ? <span className="block text-xs text-muted">That is all you have.</span> : null}
          {max === 0 ? <span className="block text-xs text-muted">{line.unit === "carton" ? "Not a full carton left." : "None left."}</span> : null}
        </span>
      </div>
    </Card>
  );
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

// ---- review ------------------------------------------------------------------------------------

function Review({ v, lines, onBack, onDone }: { v: VisitShop; lines: { product: Product; unit: SaleUnit; quantity: number }[]; onBack: () => void; onDone: (s: Sale) => void }) {
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const today = todayNepal();
  const [discount, setDiscount] = useState("0");
  const [cash, setCash] = useState("0");
  const [due, setDue] = useState(addDays(today, v.shop.dueDays));
  const [problem, setProblem] = useState<string | null>(null);
  const create = useApiMutation((api, input: Parameters<typeof api.sales.create>[0]) => api.sales.create(input), DAY_AFFECTS);

  const priced = lines.map((l) => priceLine(l.product, l.quantity, l.unit));
  const discountPaisa = parseRupees(discount);
  const cashPaisa = parseRupees(cash);
  const money = saleMoney(priced, discountPaisa ?? -1, cashPaisa ?? -1);
  const moneyProblem = discountPaisa === null ? "Enter the discount in rupees, or 0." : cashPaisa === null ? "Enter the cash paid now in rupees, or 0." : money.problems[0];
  const dueProblem = money.creditPaisa > 0 ? checkDueDate(due, today) : null;
  const credit = checkCreditLimit(v.shop.balancePaisa, money.creditPaisa, v.shop.creditLimitPaisa, "salesman");
  const ready = !moneyProblem && !dueProblem && credit.ok;

  const confirm = () => single(async () => {
    setProblem(null);
    try {
      const sale = await create.mutateAsync({
        idempotencyKey: key,
        visitId: v.visit.id,
        lines: lines.map((l) => ({ productId: l.product.id, unit: l.unit, quantity: l.quantity })),
        discountPaisa: discountPaisa!,
        cashPaidPaisa: cashPaisa!,
        dueDate: money.creditPaisa > 0 ? due : undefined,
      });
      renew();
      toast(`Invoice ${sale.invoiceNo} made.`);
      onDone(sale);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" dense aria-labelledby="review-items">
        <h2 id="review-items" className="text-title tracking-normal">
          Items
        </h2>
        <ul className="m-0 mt-3 list-none p-0">
          {lines.map((l, i) => (
            <li key={l.product.id} className="flex justify-between gap-3 border-t border-rule-2 py-2.5">
              <span>
                <span className="block font-medium">{l.product.name}</span>
                <span className="block text-sm text-muted">
                  {l.unit === "carton" ? `${l.quantity} carton${l.quantity === 1 ? "" : "s"}` : countUnits(l.quantity, l.product.unitName)} at <MoneyText paisa={priced[i].pricePaisa} />
                </span>
              </span>
              <MoneyText paisa={priced[i].totalPaisa} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">Prices come from the product list. They cannot be changed here.</p>
      </Card>

      <Card as="section" dense aria-label="Payment and credit">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Input label="Discount (Rs)" inputMode="decimal" autoComplete="off" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <div>
            <Input label="Paid now in cash (Rs)" inputMode="decimal" autoComplete="off" value={cash} onChange={(e) => setCash(e.target.value)} />
            <Button variant="quiet" size="sm" className="-mt-4 mb-4" onClick={() => setCash(formatAmount(money.totalPaisa))}>
              All of it in cash
            </Button>
          </div>
          {money.creditPaisa > 0 ? <Input label="Due date for the credit" type="date" min={today} value={due} error={dueProblem ?? undefined} onChange={(e) => setDue(e.target.value)} /> : null}
        </div>
        <dl className="m-0 flex flex-col gap-1.5 border-t border-rule-2 pt-4">
          {[
            ["Items", money.subtotalPaisa],
            ["Discount", -money.discountPaisa],
            ["Total", money.totalPaisa],
            ["Paid now in cash", money.cashPaidPaisa],
            ["On credit (udharo)", money.creditPaisa],
          ].map(([k, n]) => (
            <div key={k as string} className={`flex justify-between gap-4 ${k === "Total" ? "border-t border-rule-2 pt-1.5 font-semibold" : ""}`}>
              <dt>{k}</dt>
              <dd className="m-0">{n === 0 && k === "Discount" ? "None" : <MoneyText paisa={n as number} />}</dd>
            </div>
          ))}
        </dl>
        {moneyProblem ? <p role="alert" className="mt-3 text-sm font-medium text-error">{moneyProblem}</p> : null}
      </Card>

      <Card as="section" dense aria-label="Credit check" className={credit.ok ? "" : "ring-2 ring-error"}>
        {money.creditPaisa === 0 ? (
          <p>Paid in full. Nothing goes on credit.</p>
        ) : credit.ok ? (
          <p>
            <MoneyText paisa={money.creditPaisa} /> goes on credit, due {/^\d{4}-\d{2}-\d{2}$/.test(due) ? formatDate(due) : "on the date above"}. {v.shop.name} stays within its credit limit of <MoneyText paisa={v.shop.creditLimitPaisa} />.
          </p>
        ) : (
          <p role="alert" className="font-medium text-error">
            This sale takes {v.shop.name} over its credit limit by {formatMoney(credit.overByPaisa)}; ask your manager. Or take more of it in cash.
          </p>
        )}
      </Card>

      <FormProblem message={problem} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={create.isPending}>
          Back to items
        </Button>
        <Button size="lg" disabled={!ready} loading={create.isPending} loadingLabel="Saving…" onClick={confirm}>
          Confirm sale
        </Button>
      </div>
    </div>
  );
}

// ---- invoice ------------------------------------------------------------------------------------

function Invoice({ sale, v, products }: { sale: Sale; v: VisitShop; products: Product[] }) {
  const toast = useToast();
  const business = useApiQuery(["business"], (api) => api.business.get());
  const b = business.data;
  const name = (id: string) => products.find((p) => p.id === id);
  const text = [
    `Invoice ${sale.invoiceNo}, ${formatDate(sale.date)}`,
    v.shop.name,
    ...sale.lines.map((l) => `${l.unit === "carton" ? `${l.quantity} carton(s)` : countUnits(l.quantity, name(l.productId)?.unitName ?? "unit")} ${name(l.productId)?.name ?? ""}: ${formatMoney(l.totalPaisa)}`),
    `Total ${formatMoney(sale.totalPaisa)}`,
    sale.cashPaidPaisa ? `Paid in cash ${formatMoney(sale.cashPaidPaisa)}` : "",
    sale.totalPaisa - (sale.cashPaidPaisa ?? 0) > 0 ? `On credit ${formatMoney(sale.totalPaisa - (sale.cashPaidPaisa ?? 0))}, due ${formatDate(sale.dueDate)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `Invoice ${sale.invoiceNo}`, text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Invoice copied. Paste it into a message.");
      }
    } catch {
      /* the person closed the share sheet */
    }
  };
  return (
    <article aria-labelledby="invoice-title">
      <Card>
        {b ? (
          <div className="mb-4 border-b-2 border-ink pb-3 text-sm">
            <p className="font-semibold">{b.name}</p>
            <p className="text-ink-2">
              {b.address}, {b.city}
            </p>
            <p className="text-ink-2">PAN {b.pan}</p>
          </div>
        ) : null}
        <p className="text-sm text-muted">Invoice</p>
        <h2 id="invoice-title" className="font-outlier text-display-s">
          No. {sale.invoiceNo}
        </h2>
        <p className="mt-1 text-ink-2">
          {v.shop.name} · {formatDateTime(sale.createdAt)}
        </p>
        <p className="text-sm text-ink-2">
          {v.shop.address}
          {v.shop.pan ? ` · PAN ${v.shop.pan}` : ""}
        </p>
        <ul className="m-0 mt-5 list-none p-0">
          {sale.lines.map((l) => (
            <li key={`${l.productId}-${l.unit}`} className="flex justify-between gap-3 border-t border-rule-2 py-2">
              <span>
                {name(l.productId)?.name ?? "…"}
                <span className="block text-sm text-muted">{l.unit === "carton" ? `${l.quantity} carton${l.quantity === 1 ? "" : "s"}` : countUnits(l.quantity, name(l.productId)?.unitName ?? "unit")}</span>
              </span>
              <MoneyText paisa={l.totalPaisa} />
            </li>
          ))}
        </ul>
        <dl className="m-0 mt-2 flex flex-col gap-1 border-t-2 border-ink pt-3">
          {sale.discountPaisa ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd className="m-0">
                <MoneyText paisa={-sale.discountPaisa} />
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd className="m-0">
              <MoneyText paisa={sale.totalPaisa} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Paid in cash</dt>
            <dd className="m-0">
              <MoneyText paisa={sale.cashPaidPaisa ?? 0} />
            </dd>
          </div>
          {sale.totalPaisa - (sale.cashPaidPaisa ?? 0) > 0 ? (
            <div className="flex justify-between">
              <dt>On credit, due {formatDate(sale.dueDate)}</dt>
              <dd className="m-0">
                <MoneyText paisa={sale.totalPaisa - (sale.cashPaidPaisa ?? 0)} />
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>
      <div className="no-print mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="secondary" size="lg" onClick={share}>
          Share
        </Button>
        <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("primary", "lg", "col-span-2")}>
          Back to {v.shop.name}
        </Link>
      </div>
    </article>
  );
}
