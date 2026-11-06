"use client";

// Orders the office takes for a shop (by phone, say): the items, the salesman who delivers them,
// and whether the shop paid now at the office or pays the salesman on delivery. The salesman
// delivers an order as a sale from his van; it then shows as delivered, with its invoice.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ImagePicker, type ImageChange } from "@/components/ui/ImagePicker";
import { Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { validatePayment } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Order, OrderLine, OrderStatus, PaymentMethod, SaleUnit } from "@/lib/api/types";
import { formatDate, formatDateTime, nepalDateOf, todayNepal } from "@/lib/dates";
import { formatAmount, formatMoney, parseRupees } from "@/lib/money";
import { countUnits } from "@/lib/units";
import { useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { newKey } from "../salesman/onVisit";

const METHOD: Record<PaymentMethod, string> = { cash: "Cash", cheque: "Cheque", online: "Online" };
const STATUSES = ["open", "all", "delivered", "cancelled"] as const;
const AFFECTS = [["orders"], ["payments"], ["shops"], ["reports"]];

const lineTotal = (l: Pick<OrderLine, "quantity" | "unitPricePaisa">) => l.quantity * l.unitPricePaisa;
export const orderEstimate = (o: Pick<Order, "lines">) => o.lines.reduce((n, l) => n + lineTotal(l), 0);
const quantityText = (l: { unit: SaleUnit; quantity: number }, unitName: string) => (l.unit === "carton" ? `${l.quantity} carton${l.quantity === 1 ? "" : "s"}` : countUnits(l.quantity, unitName));

/** How the order is paid, in a few words. */
export const orderPayment = (o: Order) =>
  o.paymentMode === "prepaid" && o.prepaid
    ? `Paid ${formatMoney(o.prepaid.amountPaisa)} at the office (${METHOD[o.prepaid.method].toLowerCase()}${o.prepaid.status === "pending" ? ", pending" : o.prepaid.status === "bounced" ? ", bounced" : ""})`
    : "Salesman collects on delivery";

/** The order's lines, with today's prices. */
export function OrderLines({ order, unitName }: { order: Order; unitName: (productId: string) => string }) {
  return (
    <ul className="m-0 list-none rounded-input border border-rule-2 p-0 text-sm">
      {order.lines.map((l) => (
        <li key={`${l.productId}-${l.unit}`} className="flex justify-between gap-3 border-t border-rule-2 px-3 py-2 first:border-t-0">
          <span>
            {l.productName}
            <span className="block text-muted">
              {quantityText(l, unitName(l.productId))} at <MoneyText paisa={l.unitPricePaisa} />
            </span>
          </span>
          <MoneyText paisa={lineTotal(l)} />
        </li>
      ))}
    </ul>
  );
}

// ---- list ----------------------------------------------------------------------------------------

export function OrderList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["status", "salesman"] as const);
  const status = STATUSES.find((s) => s === url.status) ?? "open";
  const filter = useMemo(() => ({ status: status === "all" ? undefined : (status as OrderStatus), salesmanId: url.salesman || undefined, pageSize: 200 }), [status, url.salesman]);
  const q = useApiQuery(["orders", "list", filter], (api) => api.orders.list(filter), { placeholderData: (prev) => prev });
  const unitName = (id: string) => look.product(id)?.unitName ?? "unit";
  const columns: Column<Order>[] = [
    { key: "date", header: "Taken", cell: (o) => <Link href={`/app/manager/orders/${o.id}`} className="text-link whitespace-nowrap">{formatDate(nepalDateOf(o.createdAt))}</Link>, sortValue: (o) => o.createdAt, csv: (o) => nepalDateOf(o.createdAt) },
    { key: "shop", header: "Shop", rowHeader: true, cell: (o) => o.shopName, sortValue: (o) => o.shopName },
    {
      key: "items",
      header: "Items",
      cell: (o) => (
        <details className="invoice-items">
          <summary className="cursor-pointer text-sm text-link whitespace-nowrap">What they ordered</summary>
          <div className="reveal-down mt-2 min-w-56">
            <OrderLines order={o} unitName={unitName} />
          </div>
        </details>
      ),
      csv: (o) => o.lines.map((l) => `${l.quantity} ${l.unit === "carton" ? "carton" : unitName(l.productId)} ${l.productName}`).join("; "),
    },
    { key: "salesman", header: "Delivers", cell: (o) => look.person(o.salesmanId), sortValue: (o) => look.person(o.salesmanId) },
    { key: "estimate", header: "About", numeric: true, cell: (o) => <MoneyText paisa={orderEstimate(o)} />, sortValue: (o) => orderEstimate(o) },
    { key: "pay", header: "Payment", cell: (o) => <span className="text-sm">{orderPayment(o)}</span> },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} />, sortValue: (o) => o.status },
  ];
  return (
    <>
      <PageHeader
        title="Orders"
        lead="Orders taken at the office. The salesman delivers each one from his van, and it becomes a sale."
        actions={
          <Link href="/app/manager/orders/new" className={buttonClass("primary", "sm")}>
            Take an order
          </Link>
        }
      />
      <div className="no-print mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          label="Order status"
          value={status}
          onChange={(v) => setUrl({ status: v === "open" ? "" : v })}
          options={[
            { value: "open", label: "To deliver" },
            { value: "all", label: "All" },
            { value: "delivered", label: "Delivered" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <div className="w-56">
          <Select label="Salesman" size="sm" value={url.salesman} onChange={(e) => setUrl({ salesman: e.target.value })}>
            <option value="">All salesmen</option>
            {look.salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Table
        caption="Orders"
        columns={columns}
        rows={q.data?.items}
        rowKey={(o) => o.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        empty={status === "open" ? { title: "Nothing to deliver", line: "Orders you take show here until a salesman delivers them." } : { title: "No orders", line: "Try another filter." }}
      />
    </>
  );
}

// ---- take an order -------------------------------------------------------------------------------

type Draft = { productId: string; unit: SaleUnit; quantity: number };

export function NewOrder() {
  const look = usePlanLookups();
  const router = useRouter();
  const toast = useToast();
  const today = todayNepal();
  const [key] = useState(newKey);
  const plans = useApiQuery(["dayPlans", "list", { from: today }], (api) => api.dayPlans.list({ from: today, pageSize: 200 }));
  const [shopId, setShopId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [lines, setLines] = useState<Draft[]>([]);
  const [productId, setProductId] = useState("");
  const [unit, setUnit] = useState<SaleUnit>("unit");
  const [quantity, setQuantity] = useState("");
  const [mode, setMode] = useState<"on_delivery" | "prepaid">("on_delivery");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bank, setBank] = useState("");
  const [chequeDate, setChequeDate] = useState(today);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<ImageChange>({ kind: "keep" });
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const shops = look.shops.filter((s) => s.active);
  const product = look.product(productId);
  const qty = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  const priceOf = (l: Draft) => {
    const p = look.product(l.productId);
    return p ? (l.unit === "carton" ? (p.cartonPricePaisa ?? 0) : p.unitPricePaisa) : 0;
  };
  const estimate = lines.reduce((n, l) => n + priceOf(l) * l.quantity, 0);
  const amountPaisa = parseRupees(amount);

  // The salesman who works the shop's route today or next, if there is one.
  const pickShop = (id: string) => {
    setShopId(id);
    const routeId = look.shop(id)?.routeId;
    const next = (plans.data?.items ?? []).filter((p) => p.routeId === routeId && (p.status === "planned" || p.status === "in_progress")).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) setSalesmanId(next.salesmanId);
  };
  const addLine = () => {
    if (!product || qty <= 0) return;
    if (unit === "carton" && !product.unitsPerCarton) return;
    const others = lines.filter((l) => !(l.productId === productId && l.unit === unit));
    const same = lines.find((l) => l.productId === productId && l.unit === unit);
    setLines([...others, { productId, unit, quantity: (same?.quantity ?? 0) + qty }]);
    setProductId("");
    setQuantity("");
    setUnit("unit");
  };

  const payProblems =
    mode === "prepaid"
      ? validatePayment({ method, amountPaisa: amountPaisa ?? 0, chequeNo, bank, chequeDate, reference, imageIds: proof.kind === "new" ? ["x"] : [] }, new Set())
      : [];
  const formProblem = !shopId ? "Choose the shop." : !salesmanId ? "Choose who delivers it." : !lines.length ? "Add at least one product." : (amountPaisa === null && mode === "prepaid" ? "Enter the amount paid in rupees." : payProblems[0]) ?? null;

  const place = useApiMutation(async (api) => {
    let prepaidPaymentId: string | undefined;
    if (mode === "prepaid") {
      const imageIds = proof.kind === "new" ? [(await api.uploads.image(proof.blob)).id] : [];
      const pay = await api.payments.create({ idempotencyKey: `${key}-pay`, shopId, method, amountPaisa: amountPaisa!, chequeNo: method === "cheque" ? chequeNo : undefined, bank: method === "cheque" ? bank : undefined, chequeDate: method === "cheque" ? chequeDate : undefined, reference: method === "online" ? reference : undefined, imageIds });
      prepaidPaymentId = pay.id;
    }
    return api.orders.create({ shopId, salesmanId, lines, paymentMode: mode, prepaidPaymentId, note });
  }, AFFECTS);

  const submit = async () => {
    setTried(true);
    if (formProblem) return;
    setProblem(null);
    try {
      const o = await place.mutateAsync(undefined);
      toast(`Order taken for ${o.shopName}.`);
      router.push(`/app/manager/orders/${o.id}`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  if (look.error) return <ErrorState message={errorMessage(look.error)} onRetry={look.retry} />;
  if (!look.ready) return <LoadingState label="Loading shops and products" />;

  return (
    <>
      <BackLink href="/app/manager/orders" label="Orders" />
      <PageHeader title="Take an order" lead="For a shop that phones or visits. The salesman delivers it from his van." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card as="section" dense aria-label="Shop and salesman">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Select label="Shop" value={shopId} error={tried && !shopId ? "Choose the shop." : undefined} onChange={(e) => pickShop(e.target.value)}>
                <option value="">Choose a shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select label="Delivered by" hint="Filled in from the shop's route when someone works it today or next." value={salesmanId} error={tried && !salesmanId ? "Choose who delivers it." : undefined} onChange={(e) => setSalesmanId(e.target.value)}>
                <option value="">Choose a salesman</option>
                {look.salesmen
                  .filter((s) => s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
              </Select>
            </div>
          </Card>

          <Card as="section" dense aria-labelledby="items-title">
            <h2 id="items-title" className="text-title tracking-normal">
              What they want
            </h2>
            <div className="mt-3 grid grid-cols-1 items-end gap-x-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Choose a product</option>
                {look.products
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
              <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as SaleUnit)}>
                <option value="unit">Pieces</option>
                {product?.unitsPerCarton ? <option value="carton">Cartons of {product.unitsPerCarton}</option> : null}
              </Select>
              <Input label="Quantity" inputMode="numeric" autoComplete="off" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
              <div className="pb-7">
                <Button variant="secondary" disabled={!product || qty <= 0} onClick={addLine}>
                  Add
                </Button>
              </div>
            </div>
            {lines.length ? (
              <ul className="m-0 list-none p-0">
                {lines.map((l) => {
                  const p = look.product(l.productId);
                  return (
                    <li key={`${l.productId}-${l.unit}`} className="flex items-center justify-between gap-3 border-t border-rule-2 py-2.5">
                      <span>
                        <span className="block font-medium">{p?.name}</span>
                        <span className="block text-sm text-muted">
                          {quantityText(l, p?.unitName ?? "unit")} at <MoneyText paisa={priceOf(l)} />
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <MoneyText paisa={priceOf(l) * l.quantity} />
                        <Button variant="quiet" size="sm" onClick={() => setLines(lines.filter((x) => x !== l))} aria-label={`Remove ${p?.name ?? "this line"}`}>
                          Remove
                        </Button>
                      </span>
                    </li>
                  );
                })}
                <li className="flex justify-between border-t-2 border-ink pt-2 font-semibold">
                  <span>About</span>
                  <MoneyText paisa={estimate} />
                </li>
              </ul>
            ) : (
              <p className={`text-sm ${tried ? "font-medium text-error" : "text-ink-2"}`}>{tried ? "Add at least one product." : "Nothing added yet."}</p>
            )}
            <p className="mt-2 text-sm text-muted">Prices are today&apos;s; the invoice uses the prices on the day it is delivered.</p>
          </Card>

          <Card as="section" dense aria-labelledby="pay-title">
            <h2 id="pay-title" className="text-title tracking-normal">
              Payment
            </h2>
            <fieldset className="mt-3">
              <legend className="visually-hidden">Who takes the money</legend>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {(
                  [
                    ["on_delivery", "The salesman collects it on delivery", "Cash, cheque, online or udharo, when he hands the goods over."],
                    ["prepaid", "Paid now, at the office", "Record it here. The salesman only delivers."],
                  ] as const
                ).map(([v, title, line]) => (
                  <li key={v}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-input border border-rule-2 p-3 has-checked:border-ink has-checked:bg-paper-3">
                      <input
                        type="radio"
                        name="order-pay"
                        className="mt-1 size-4 accent-ink"
                        checked={mode === v}
                        onChange={() => {
                          setMode(v);
                          if (v === "prepaid" && !amount && estimate) setAmount(formatAmount(estimate).replace(/,/g, ""));
                        }}
                      />
                      <span>
                        <span className="block font-medium">{title}</span>
                        <span className="block text-sm text-ink-2">{line}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {mode === "prepaid" ? (
              <div className="mt-4 border-t border-rule-2 pt-4">
                <Segmented label="How it was paid" value={method} onChange={setMethod} options={(["cash", "cheque", "online"] as const).map((m) => ({ value: m, label: METHOD[m] }))} />
                <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <Input label="Amount paid (Rs)" inputMode="decimal" autoComplete="off" value={amount} error={tried && (amountPaisa === null || payProblems.includes("Enter an amount above zero.")) ? "Enter the amount paid in rupees." : undefined} onChange={(e) => setAmount(e.target.value)} />
                  {method === "cheque" ? (
                    <>
                      <Input label="Cheque number" inputMode="numeric" autoComplete="off" value={chequeNo} error={tried && payProblems.includes("Enter the cheque number.") ? "Enter the cheque number." : undefined} onChange={(e) => setChequeNo(e.target.value)} />
                      <Input label="Bank" autoComplete="off" value={bank} error={tried && payProblems.includes("Enter the bank.") ? "Enter the bank." : undefined} onChange={(e) => setBank(e.target.value)} />
                      <Input label="Date on the cheque" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                    </>
                  ) : method === "online" ? (
                    <Input label="Reference number" autoComplete="off" value={reference} error={tried && payProblems.includes("Enter the payment's reference number.") ? "Enter the payment's reference number." : undefined} onChange={(e) => setReference(e.target.value)} />
                  ) : null}
                </div>
                {method !== "cash" ? (
                  <ImagePicker
                    title={method === "cheque" ? "Photo of the cheque" : "Screenshot of the payment"}
                    alt={method === "cheque" ? "The cheque" : "The payment screenshot"}
                    change={proof}
                    onChange={setProof}
                    hint="Required. PNG, JPEG or WebP."
                    emptyText="Not added yet"
                    maxPx={1600}
                    pendingText="saved with the order"
                  />
                ) : null}
                {method !== "cash" ? <p className="mt-2 text-sm text-ink-2">A cheque or online payment stays pending until it is confirmed on Payments.</p> : null}
              </div>
            ) : null}
          </Card>

          <Card as="section" dense aria-label="Note">
            <Textarea label="Note for the salesman" hint="Optional, like when to come." value={note} onChange={(e) => setNote(e.target.value)} />
          </Card>
          <FormProblem message={problem ?? (tried ? formProblem : null)} />
          <div>
            <Button size="lg" loading={place.isPending} loadingLabel="Saving…" onClick={submit}>
              Take the order
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- one order -----------------------------------------------------------------------------------

export function OrderDetail({ id }: { id: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["orders", "detail", id], (api) => api.orders.get(id));
  const [cancelling, setCancelling] = useState(false);
  if (q.isPending) return <LoadingState label="Loading the order" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return <EmptyState title="This order was not found" line="Go back to the orders." action={<Link href="/app/manager/orders" className={buttonClass("secondary", "sm")}>Back to orders</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const o = q.data;
  return (
    <>
      <BackLink href="/app/manager/orders" label="Orders" />
      <PageHeader title={`Order for ${o.shopName}`} lead={`Taken ${formatDateTime(o.createdAt)} by ${look.person(o.takenBy)}`} actions={<StatusBadge status={o.status} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="section" dense className="lg:col-span-2" aria-labelledby="lines-title">
          <h2 id="lines-title" className="mb-3 text-title tracking-normal">
            What they ordered
          </h2>
          <OrderLines order={o} unitName={(pid) => look.product(pid)?.unitName ?? "unit"} />
          <p className="mt-3 flex justify-between font-semibold">
            <span>About</span>
            <MoneyText paisa={orderEstimate(o)} />
          </p>
          {o.note ? <p className="mt-4 text-ink-2">Note: {o.note}</p> : null}
        </Card>
        <Card as="section" dense aria-label="Delivery and payment">
          <dl className="m-0 flex flex-col gap-3">
            <div>
              <dt className="text-sm text-muted">Delivered by</dt>
              <dd className="m-0 mt-0.5">{look.person(o.salesmanId)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Payment</dt>
              <dd className="m-0 mt-0.5">
                {o.prepaid ? (
                  <Link href={`/app/manager/payments/${o.prepaid.paymentId}`} className="text-link">
                    {orderPayment(o)}
                  </Link>
                ) : (
                  orderPayment(o)
                )}
              </dd>
            </div>
            {o.status === "delivered" ? (
              <div>
                <dt className="text-sm text-muted">Delivered</dt>
                <dd className="m-0 mt-0.5">
                  {o.deliveredAt ? `${formatDateTime(o.deliveredAt)}, ` : ""}
                  {o.saleId ? (
                    <Link href={`/app/manager/sales/${o.saleId}`} className="text-link">
                      invoice {o.invoiceNo ?? ""}
                    </Link>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {o.status === "cancelled" ? (
              <div>
                <dt className="text-sm text-muted">Cancelled</dt>
                <dd className="m-0 mt-0.5">{o.cancelReason}</dd>
              </div>
            ) : null}
          </dl>
          {o.status === "open" ? (
            <Button variant="secondary" className="mt-5 w-full" onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          ) : null}
          {o.status === "open" && o.prepaid ? <p className="mt-2 text-sm text-muted">Cancelling does not undo the payment; it stays on the shop&apos;s balance as credit.</p> : null}
        </Card>
      </div>
      {cancelling ? <CancelOrder order={o} onClose={() => setCancelling(false)} /> : null}
    </>
  );
}

function CancelOrder({ order, onClose }: { order: Order; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = useApiMutation((api, r: string) => api.orders.cancel(order.id, r), AFFECTS);
  const error = tried && !reason.trim() ? "Say why the order is cancelled." : reason.length > 200 ? "Keep the reason under 200 characters." : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel the order for ${order.shopName}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button
            loading={cancel.isPending}
            loadingLabel="Cancelling…"
            onClick={async () => {
              setTried(true);
              if (!reason.trim() || reason.length > 200) return;
              setProblem(null);
              try {
                await cancel.mutateAsync(reason);
                onClose();
                toast("Order cancelled.");
              } catch (e) {
                setProblem(errorMessage(e));
              }
            }}
          >
            Cancel order
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">The salesman will no longer see it to deliver. This cannot be undone.</p>
      <Textarea label="Reason" hint="Required." value={reason} error={error} onChange={(e) => setReason(e.target.value)} />
      <FormProblem message={problem} />
    </Modal>
  );
}
