"use client";

// Collect a payment at a shop: what it pays off (one unpaid invoice, or the balance), the amount,
// then how it was paid.
// Cash is confirmed at once. A cheque needs its number, bank, date and a photo; an online
// payment its reference and a screenshot. Both stay pending until the manager confirms them.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Camera, type Shot } from "@/components/ui/Camera";
import { Segmented } from "@/components/ui/Controls";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { collectable, openInvoices, overInvoice, overLimit, validatePayment } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Payment, PaymentMethod, VisitShop } from "@/lib/api/types";
import { formatDate, todayNepal } from "@/lib/dates";
import { formatMoney, parseRupees } from "@/lib/money";
import { useOnceKey, useSingleFlight, VisitGate } from "./onVisit";
import { InvoiceItems } from "../records/InvoiceItems";
import { DAY_AFFECTS } from "./useToday";

export function NewPayment() {
  return <VisitGate title="Collect payment">{(v) => <PaymentForm v={v} />}</VisitGate>;
}

function PaymentForm({ v }: { v: VisitShop }) {
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const sales = useApiQuery(["sales", "list", { shopId: v.shop.id, open: true }], (api) => api.sales.list({ shopId: v.shop.id, status: "confirmed", pageSize: 100 }));
  const paid = useApiQuery(["payments", "list", { shopId: v.shop.id }], (api) => api.payments.list({ shopId: v.shop.id, pageSize: 200 }));
  const open = useMemo(() => (sales.data && paid.data ? openInvoices(sales.data.items, paid.data.items) : []), [sales.data, paid.data]);
  const focusAmount = useRef(false);
  const [amount, setAmount] = useState("");
  const [saleId, setSaleId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [chequeNo, setChequeNo] = useState("");
  const [bank, setBank] = useState("");
  const [chequeDate, setChequeDate] = useState(todayNepal());
  const [reference, setReference] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Payment | null>(null);

  // The photo is uploaded first; the payment then points at it.
  const create = useApiMutation(async (api, input: Omit<Parameters<typeof api.payments.create>[0], "imageIds"> & { shot: Shot | null }) => {
    const { shot: photo, ...rest } = input;
    const imageIds = photo ? [(await api.uploads.image(photo.blob)).id] : [];
    return api.payments.create({ ...rest, imageIds });
  }, DAY_AFFECTS);

  const amountPaisa = parseRupees(amount);
  const limit = collectable(v.shop.balancePaisa, v.shop.inClearingPaisa);
  const against = open.find((x) => x.sale.id === saleId);
  const invoiceProblem = against && amountPaisa !== null && amountPaisa > against.unpaidPaisa ? overInvoice(against.sale.invoiceNo, against.unpaidPaisa) : null;

  // Choosing an invoice fills in what is unpaid on it and puts the cursor in the amount.
  useEffect(() => {
    if (!focusAmount.current) return;
    focusAmount.current = false;
    document.querySelector<HTMLInputElement>("[data-pay-amount]")?.focus();
  });
  const choose = (id: string) => {
    setSaleId(id);
    const x = open.find((o) => o.sale.id === id);
    if (x) setAmount(String(Math.min(x.unpaidPaisa, limit) / 100));
    focusAmount.current = true;
  };
  const problems = validatePayment(
    { method, amountPaisa: amountPaisa ?? 0, chequeNo, bank, chequeDate, reference, imageIds: shot ? ["photo"] : [] },
    new Set(),
    limit,
  );
  const show = (m: string) => (tried && problems.includes(m) ? m : undefined);

  if (done)
    return (
      <Card as="section" aria-label="Payment recorded">
        <p className="text-sm text-muted">Payment recorded</p>
        <p className="mt-1 font-outlier text-display-s">{formatMoney(done.amountPaisa)}</p>
        <p className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge status={done.status} />
          {done.status === "pending" ? "Pending until your manager confirms it. It does not lower what the shop owes until then." : "Confirmed. It already lowers what the shop owes."}
        </p>
        <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Back to {v.shop.name}
        </Link>
      </Card>
    );

  if (limit <= 0)
    return (
      <Card as="section" aria-label="Nothing to collect">
        <p className="text-lg font-medium">Nothing to collect</p>
        <p className="mt-2 text-ink-2">
          {v.shop.balancePaisa > 0
            ? `${v.shop.name} owes ${formatMoney(v.shop.balancePaisa)}, and cheques or online payments already in clearing cover it.`
            : `${v.shop.name} owes nothing right now.`}{" "}
          There is nothing to collect.
        </p>
        <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("secondary", "lg", "mt-6 w-full")}>
          Back to {v.shop.name}
        </Link>
      </Card>
    );

  const submit = () => single(async () => {
    setTried(true);
    if (problems.length || invoiceProblem) return;
    setProblem(null);
    try {
      const payment = await create.mutateAsync({
        idempotencyKey: key,
        visitId: v.visit.id,
        saleId: saleId || undefined,
        method,
        amountPaisa: amountPaisa!,
        chequeNo: method === "cheque" ? chequeNo : undefined,
        bank: method === "cheque" ? bank : undefined,
        chequeDate: method === "cheque" ? chequeDate : undefined,
        reference: method === "online" ? reference : undefined,
        shot: method === "cash" ? null : shot,
      });
      renew();
      toast(payment.status === "pending" ? "Payment saved, pending your manager." : "Cash payment saved.");
      setDone(payment);
    } catch (e) {
      setProblem(errorMessage(e));
    }
   });

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" dense aria-label="Amount">
        <p className="text-sm text-muted">
          The shop owes <MoneyText paisa={Math.max(0, v.shop.balancePaisa)} />
          {v.shop.inClearingPaisa ? (
            <>
              , with <MoneyText paisa={v.shop.inClearingPaisa} /> already in clearing
            </>
          ) : null}
          .
        </p>
        <fieldset className="mt-4">
          <legend className="mb-2 font-medium">What does it pay off?</legend>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-input border border-rule-2 p-3 has-checked:border-ink has-checked:bg-paper-3">
                <input type="radio" name="pays-off" className="mt-1 size-4 accent-ink" checked={saleId === ""} onChange={() => choose("")} />
                <span>
                  <span className="block font-medium">The overall balance</span>
                  <span className="block text-sm text-ink-2">Goes against the oldest udharo first.</span>
                </span>
              </label>
            </li>
            {open.map((x) => (
              <li key={x.sale.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-input border border-rule-2 p-3 has-checked:border-ink has-checked:bg-paper-3">
                  <input type="radio" name="pays-off" className="mt-1 size-4 accent-ink" checked={saleId === x.sale.id} onChange={() => choose(x.sale.id)} />
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
                    <span>
                      <span className="block font-medium">Invoice {x.sale.invoiceNo}</span>
                      <span className="block text-sm text-muted">{formatDate(x.sale.date)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block">
                        <MoneyText paisa={x.unpaidPaisa} /> unpaid
                      </span>
                      <span className="block text-sm text-muted">
                        of <MoneyText paisa={x.sale.totalPaisa} />
                      </span>
                    </span>
                  </span>
                </label>
                <InvoiceItems saleId={x.sale.id} lines={x.sale.lines} label={`What they bought on invoice ${x.sale.invoiceNo}`} className="ml-7 mt-1" />
              </li>
            ))}
          </ul>
          {sales.isPending || paid.isPending ? <p className="mt-2 text-sm text-muted">Loading the unpaid invoices…</p> : sales.isError || paid.isError ? <p className="mt-2 text-sm text-ink-2">The invoices did not load; the payment goes against the balance.</p> : open.length === 0 ? <p className="mt-2 text-sm text-ink-2">No single invoice of yours is unpaid; the payment goes against the balance.</p> : null}
        </fieldset>
        <div className="mt-4 max-w-xs">
          <Input
            label="Amount (Rs)"
            inputMode="decimal"
            size="lg"
            autoComplete="off"
            data-pay-amount=""
            value={amount}
            hint={against ? `Up to ${formatMoney(Math.min(against.unpaidPaisa, limit))} on this invoice.` : `Up to ${formatMoney(limit)}.`}
            error={show("Enter an amount above zero.") ?? invoiceProblem ?? (amountPaisa !== null && amountPaisa > limit ? overLimit(limit) : undefined) ?? (tried && amountPaisa === null ? "Enter the amount in rupees, like 6,600." : undefined)}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </Card>

      <Card as="section" dense aria-label="How it was paid">
        <p className="mb-3 font-medium">How was it paid?</p>
        <Segmented
          label="Payment method"
          value={method}
          onChange={(m) => {
            setMethod(m);
            setShot(null);
          }}
          options={[
            { value: "cash", label: "Cash" },
            { value: "cheque", label: "Cheque" },
            { value: "online", label: "Online" },
          ]}
        />
        {method === "cash" ? (
          <p className="mt-4 text-ink-2">Cash is confirmed at once and lowers what the shop owes straight away.</p>
        ) : (
          <>
            <p className="mt-4 rounded-input border border-rule-2 bg-paper-3 p-3 font-medium">
              {method === "cheque" ? "A cheque" : "An online payment"} stays pending until your manager confirms it. Until then it does not lower what the shop owes.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {method === "cheque" ? (
                <>
                  <Input label="Cheque number" inputMode="numeric" autoComplete="off" value={chequeNo} error={show("Enter the cheque number.")} onChange={(e) => setChequeNo(e.target.value)} />
                  <Input label="Bank" autoComplete="off" value={bank} error={show("Enter the bank.")} onChange={(e) => setBank(e.target.value)} />
                  <Input label="Date on the cheque" type="date" value={chequeDate} error={show("Enter the date on the cheque.")} onChange={(e) => setChequeDate(e.target.value)} />
                </>
              ) : (
                <Input label="Reference number" autoComplete="off" hint="From the payment app's receipt." value={reference} error={show("Enter the payment's reference number.")} onChange={(e) => setReference(e.target.value)} />
              )}
            </div>
            <Camera label={method === "cheque" ? "Photo of the cheque (required)" : "Screenshot of the payment (required)"} shot={shot} onShot={setShot} />
            {tried && (problems.includes("Add a photo of the cheque.") || problems.includes("Add a screenshot of the payment.")) ? (
              <p role="alert" className="mt-2 text-sm font-medium text-error">
                {method === "cheque" ? "Add a photo of the cheque." : "Add a screenshot of the payment."}
              </p>
            ) : null}
          </>
        )}
      </Card>

      <FormProblem message={problem} />
      <Button size="lg" className="w-full" loading={create.isPending} loadingLabel="Saving…" onClick={submit}>
        Save payment
      </Button>
    </div>
  );
}
