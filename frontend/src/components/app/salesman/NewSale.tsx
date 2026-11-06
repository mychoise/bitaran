"use client";

// A sale at one shop, in three screens. Pick: products you carry, with search, category chips,
// big rows with a piece or carton toggle and a stepper that stops at what you have left, and a
// bar with the running total. Review: the items, a discount, the due date for credit, cash paid
// now, and the credit check in plain words. Done: the invoice, to print or share.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Camera, type Shot } from "@/components/ui/Camera";
import { Card, MoneyText } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { priceLine, saleMoney, splitSale, validatePayment, collectable } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Product, Sale, SaleUnit, VisitShop } from "@/lib/api/types";
import { formatDate, formatDateTime, todayNepal } from "@/lib/dates";
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
  const [extra, setExtra] = useState<ExtraPayment[]>([]);

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

  if (sale) return <Invoice sale={sale} v={v} products={list} extra={extra} />;
  if (stage === "review") return <Review v={v} lines={lines} onBack={() => setStage("pick")} onDone={(s, x) => {
          setSale(s);
          setExtra(x);
        }} />;
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

type Method = "cash" | "cheque" | "online" | "udharo";
const METHODS: { value: Method; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
  { value: "udharo", label: "Udharo" },
];
/** A cheque or online payment saved against the new invoice, or why it was not. */
export type ExtraPayment = { method: "cheque" | "online"; amountPaisa: number; status?: string; problem?: string };

function Review({ v, lines, onBack, onDone }: { v: VisitShop; lines: { product: Product; unit: SaleUnit; quantity: number }[]; onBack: () => void; onDone: (s: Sale, extra: ExtraPayment[]) => void }) {
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const today = todayNepal();
  const [discount, setDiscount] = useState("0");
  const [chosen, setChosen] = useState<Set<Method>>(new Set(["cash"]));
  const [amounts, setAmounts] = useState<Record<"cash" | "cheque" | "online", string>>({ cash: "", cheque: "", online: "" });
  const [chequeNo, setChequeNo] = useState("");
  const [bank, setBank] = useState("");
  const [chequeDate, setChequeDate] = useState(today);
  const [reference, setReference] = useState("");
  const [chequeShot, setChequeShot] = useState<Shot | null>(null);
  const [onlineShot, setOnlineShot] = useState<Shot | null>(null);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const focusOn = useRef<Method | null>(null);

  // The sale first, with any cash; then each cheque or online payment against its invoice.
  const create = useApiMutation(
    async (api, input: { sale: Parameters<typeof api.sales.create>[0]; extra: { method: "cheque" | "online"; amountPaisa: number; shot: Shot; chequeNo?: string; bank?: string; chequeDate?: string; reference?: string }[] }) => {
      const sale = await api.sales.create(input.sale);
      const done: ExtraPayment[] = [];
      for (const x of input.extra) {
        try {
          const { id } = await api.uploads.image(x.shot.blob);
          const p = await api.payments.create({ idempotencyKey: `${input.sale.idempotencyKey}-${x.method}`, visitId: v.visit.id, saleId: sale.id, method: x.method, amountPaisa: x.amountPaisa, chequeNo: x.chequeNo, bank: x.bank, chequeDate: x.chequeDate, reference: x.reference, imageIds: [id] });
          done.push({ method: x.method, amountPaisa: x.amountPaisa, status: p.status });
        } catch (e) {
          done.push({ method: x.method, amountPaisa: x.amountPaisa, problem: errorMessage(e) });
        }
      }
      return { sale, done };
    },
    DAY_AFFECTS,
  );

  const priced = lines.map((l) => priceLine(l.product, l.quantity, l.unit));
  const discountPaisa = parseRupees(discount);
  const money = saleMoney(priced, discountPaisa ?? -1, 0);
  const total = money.totalPaisa;
  const paying = (["cash", "cheque", "online"] as const).filter((m) => chosen.has(m));
  const parts = Object.fromEntries(paying.map((m) => [m, parseRupees(amounts[m])])) as Partial<Record<"cash" | "cheque" | "online", number | null>>;
  const split = splitSale(total, parts, chosen.has("udharo"));
  const chequeProblems = chosen.has("cheque") ? validatePayment({ method: "cheque", amountPaisa: parts.cheque ?? 1, chequeNo, bank, chequeDate, imageIds: chequeShot ? ["x"] : [] }, new Set()).filter((m) => !m.includes("amount")) : [];
  const onlineProblems = chosen.has("online") ? validatePayment({ method: "online", amountPaisa: parts.online ?? 1, reference, imageIds: onlineShot ? ["x"] : [] }, new Set()).filter((m) => !m.includes("amount")) : [];
  // Cheque and online can be no more than the shop will owe after the sale and its cash.
  const nonCash = (parts.cheque ?? 0) + (parts.online ?? 0);
  const nonCashMax = collectable(v.shop.balancePaisa + total - (parts.cash ?? 0), v.shop.inClearingPaisa);
  const nonCashProblem =
    nonCash > nonCashMax
      ? nonCashMax === 0
        ? `${v.shop.name}'s credit already covers the rest, so nothing can go by cheque or online.`
        : `${v.shop.name}'s credit covers part of this sale, so at most ${formatMoney(nonCashMax)} can go by cheque or online.`
      : null;
  const moneyProblem = discountPaisa === null ? "Enter the discount in rupees, or 0." : (money.problems[0] ?? split.problems[0] ?? nonCashProblem ?? undefined);
  const ready = !moneyProblem && !chequeProblems.length && !onlineProblems.length;
  const show = (list: string[], m: string) => (tried && list.includes(m) ? m : undefined);

  // Choosing a method puts the cursor in its amount.
  useEffect(() => {
    if (!focusOn.current) return;
    document.querySelector<HTMLInputElement>(`[data-pay="${focusOn.current}"]`)?.focus();
    focusOn.current = null;
  });

  const toggle = (m: Method) => {
    const next = new Set(chosen);
    if (next.has(m)) {
      next.delete(m);
      if (m !== "udharo") setAmounts((a) => ({ ...a, [m]: "" }));
    } else {
      next.add(m);
      if (m !== "udharo") {
        // Suggest what is still unpaid.
        const others = (["cash", "cheque", "online"] as const).filter((x) => x !== m && next.has(x)).reduce((n, x) => n + (parseRupees(amounts[x]) ?? 0), 0);
        const left = total - others;
        if (left > 0 && !amounts[m]) setAmounts((a) => ({ ...a, [m]: formatAmount(left).replace(/,/g, "") }));
        focusOn.current = m;
      }
    }
    setChosen(next);
  };

  const confirm = () => single(async () => {
    setTried(true);
    if (!ready) return;
    setProblem(null);
    try {
      const { sale, done } = await create.mutateAsync({
        sale: {
          idempotencyKey: key,
          visitId: v.visit.id,
          lines: lines.map((l) => ({ productId: l.product.id, unit: l.unit, quantity: l.quantity })),
          discountPaisa: discountPaisa!,
          cashPaidPaisa: parts.cash ?? 0,
        },
        extra: [
          ...(chosen.has("cheque") ? [{ method: "cheque" as const, amountPaisa: parts.cheque!, shot: chequeShot!, chequeNo, bank, chequeDate }] : []),
          ...(chosen.has("online") ? [{ method: "online" as const, amountPaisa: parts.online!, shot: onlineShot!, reference }] : []),
        ],
      });
      renew();
      toast(done.some((d) => d.problem) ? `Invoice ${sale.invoiceNo} made, but a payment was not saved.` : `Invoice ${sale.invoiceNo} made.`);
      onDone(sale, done);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  const amountField = (m: "cash" | "cheque" | "online", label: string) => (
    <Input
      label={label}
      inputMode="decimal"
      autoComplete="off"
      data-pay={m}
      value={amounts[m]}
      error={tried && (parts[m] === null || (parts[m] ?? 0) <= 0) ? `Enter the ${m} amount.` : undefined}
      onChange={(e) => setAmounts((a) => ({ ...a, [m]: e.target.value }))}
    />
  );

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
        <div className="mt-4 max-w-xs">
          <Input label="Discount (Rs)" inputMode="decimal" autoComplete="off" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <p className="flex justify-between border-t border-rule-2 pt-3 text-lg font-semibold">
          <span>Total</span>
          <MoneyText paisa={total} />
        </p>
      </Card>

      <Card as="section" dense aria-labelledby="pay-title">
        <h2 id="pay-title" className="text-title tracking-normal">
          How is it paid?
        </h2>
        <p className="mt-1 text-sm text-ink-2">Choose one or more. Udharo takes whatever is left.</p>
        <div role="group" aria-label="How is it paid" className="segmented mt-3">
          {METHODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={chosen.has(m.value)} onClick={() => toggle(m.value)}>
              {m.label}
            </button>
          ))}
        </div>

        {chosen.has("cash") ? (
          <div className="mt-5 border-t border-rule-2 pt-4">
            <h3 className="font-medium">Cash</h3>
            <div className="mt-2 max-w-xs">{amountField("cash", "Cash now (Rs)")}</div>
          </div>
        ) : null}

        {chosen.has("cheque") ? (
          <div className="mt-5 border-t border-rule-2 pt-4">
            <h3 className="font-medium">Cheque</h3>
            <p className="mt-1 text-sm text-ink-2">Pending until your manager confirms it.</p>
            <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {amountField("cheque", "Cheque amount (Rs)")}
              <Input label="Cheque number" inputMode="numeric" autoComplete="off" value={chequeNo} error={show(chequeProblems, "Enter the cheque number.")} onChange={(e) => setChequeNo(e.target.value)} />
              <Input label="Bank" autoComplete="off" value={bank} error={show(chequeProblems, "Enter the bank.")} onChange={(e) => setBank(e.target.value)} />
              <Input label="Date on the cheque" type="date" value={chequeDate} error={show(chequeProblems, "Enter the date on the cheque.")} onChange={(e) => setChequeDate(e.target.value)} />
            </div>
            <Camera label="Photo of the cheque (required)" shot={chequeShot} onShot={setChequeShot} />
            {show(chequeProblems, "Add a photo of the cheque.") ? <p role="alert" className="mt-2 text-sm font-medium text-error">Add a photo of the cheque.</p> : null}
          </div>
        ) : null}

        {chosen.has("online") ? (
          <div className="mt-5 border-t border-rule-2 pt-4">
            <h3 className="font-medium">Online</h3>
            <p className="mt-1 text-sm text-ink-2">Pending until your manager confirms it.</p>
            <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {amountField("online", "Online amount (Rs)")}
              <Input label="Reference number" autoComplete="off" hint="From the payment app's receipt." value={reference} error={show(onlineProblems, "Enter the payment's reference number.")} onChange={(e) => setReference(e.target.value)} />
            </div>
            <Camera label="Screenshot of the payment (required)" shot={onlineShot} onShot={setOnlineShot} />
            {show(onlineProblems, "Add a screenshot of the payment.") ? <p role="alert" className="mt-2 text-sm font-medium text-error">Add a screenshot of the payment.</p> : null}
          </div>
        ) : null}

        <dl className="m-0 mt-4 flex flex-col gap-1.5 border-t border-rule-2 pt-4">
          {(
            [
              ["Total", total],
              ...paying.map((m) => [m === "cash" ? "Cash" : m === "cheque" ? "Cheque (pending)" : "Online (pending)", parts[m] ?? 0] as [string, number]),
              ...(chosen.has("udharo") ? ([["Udharo", split.creditPaisa]] as [string, number][]) : []),
            ] as [string, number][]
          ).map(([k, n]) => (
            <div key={k} className={`flex justify-between gap-4 ${k === "Total" ? "font-semibold" : ""}`}>
              <dt>{k}</dt>
              <dd className="m-0">
                <MoneyText paisa={n} />
              </dd>
            </div>
          ))}
        </dl>
        {moneyProblem && (tried || split.paidPaisa > total || nonCashProblem) ? (
          <p role="alert" className="mt-3 text-sm font-medium text-error">
            {moneyProblem}
          </p>
        ) : null}
      </Card>

      <FormProblem message={problem} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={create.isPending}>
          Back to items
        </Button>
        <Button size="lg" loading={create.isPending} loadingLabel="Saving…" onClick={confirm}>
          Confirm sale
        </Button>
      </div>
    </div>
  );
}

// ---- invoice ------------------------------------------------------------------------------------

function Invoice({ sale, v, products, extra }: { sale: Sale; v: VisitShop; products: Product[]; extra: ExtraPayment[] }) {
  const cash = sale.cashPaidPaisa ?? 0;
  const saved = extra.filter((x) => !x.problem);
  const failed = extra.filter((x) => x.problem);
  const udharo = Math.max(0, sale.totalPaisa - cash - saved.reduce((n, x) => n + x.amountPaisa, 0));
  const methodName = (m: ExtraPayment["method"]) => (m === "cheque" ? "Cheque" : "Online");
  const toast = useToast();
  const business = useApiQuery(["business"], (api) => api.business.get());
  const b = business.data;
  const name = (id: string) => products.find((p) => p.id === id);
  const text = [
    `Invoice ${sale.invoiceNo}, ${formatDate(sale.date)}`,
    v.shop.name,
    ...sale.lines.map((l) => `${l.unit === "carton" ? `${l.quantity} carton(s)` : countUnits(l.quantity, name(l.productId)?.unitName ?? "unit")} ${name(l.productId)?.name ?? ""}: ${formatMoney(l.totalPaisa)}`),
    `Total ${formatMoney(sale.totalPaisa)}`,
    cash ? `Paid in cash ${formatMoney(cash)}` : "",
    ...saved.map((x) => `${methodName(x.method)} ${formatMoney(x.amountPaisa)} (pending)`),
    udharo > 0 ? `Udharo ${formatMoney(udharo)}` : "",
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
          {cash ? (
            <div className="flex justify-between">
              <dt>Paid in cash</dt>
              <dd className="m-0">
                <MoneyText paisa={cash} />
              </dd>
            </div>
          ) : null}
          {saved.map((x) => (
            <div key={x.method} className="flex justify-between">
              <dt>{methodName(x.method)} (pending)</dt>
              <dd className="m-0">
                <MoneyText paisa={x.amountPaisa} />
              </dd>
            </div>
          ))}
          {udharo > 0 ? (
            <div className="flex justify-between">
              <dt>Udharo</dt>
              <dd className="m-0">
                <MoneyText paisa={udharo} />
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>
      {failed.length ? (
        <div role="alert" className="no-print mt-4 rounded-stock border-2 border-error bg-error-soft p-4">
          {failed.map((x) => (
            <p key={x.method}>
              <span className="font-medium">The {x.method === "cheque" ? "cheque" : "online payment"} of {formatMoney(x.amountPaisa)} was not saved.</span> {x.problem} The sale is saved; record it with Collect payment.
            </p>
          ))}
          <Link href={`/app/salesman/payment/new?visit=${v.visit.id}`} className={buttonClass("secondary", "sm", "mt-3")}>
            Collect payment
          </Link>
        </div>
      ) : null}
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
