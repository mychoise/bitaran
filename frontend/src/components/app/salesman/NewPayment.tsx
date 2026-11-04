"use client";

// Collect a payment at a shop: the amount, optionally one sale it is for, then how it was paid.
// Cash is confirmed at once. A cheque needs its number, bank, date and a photo; an online
// payment its reference and a screenshot. Both stay pending until the manager confirms them.

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Camera, type Shot } from "@/components/ui/Camera";
import { Segmented } from "@/components/ui/Controls";
import { Card, MoneyText, StatusBadge } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { validatePayment } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Payment, PaymentMethod, VisitShop } from "@/lib/api/types";
import { formatDate, todayNepal } from "@/lib/dates";
import { formatMoney, parseRupees } from "@/lib/money";
import { useOnceKey, useSingleFlight, VisitGate } from "./onVisit";
import { DAY_AFFECTS } from "./useToday";

export function NewPayment() {
  return <VisitGate title="Collect payment">{(v) => <PaymentForm v={v} />}</VisitGate>;
}

function PaymentForm({ v }: { v: VisitShop }) {
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const sales = useApiQuery(["sales", "list", { shopId: v.shop.id }], (api) => api.sales.list({ shopId: v.shop.id, pageSize: 20 }));
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
  const problems = validatePayment(
    { method, amountPaisa: amountPaisa ?? 0, chequeNo, bank, chequeDate, reference, imageIds: shot ? ["photo"] : [] },
    new Set(),
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

  const submit = () => single(async () => {
    setTried(true);
    if (problems.length) return;
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
        <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Input label="Amount (Rs)" inputMode="decimal" size="lg" autoComplete="off" value={amount} error={show("Enter an amount above zero.") ?? (tried && amountPaisa === null ? "Enter the amount in rupees, like 6,600." : undefined)} onChange={(e) => setAmount(e.target.value)} />
          <Select label="For one sale (optional)" value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">Towards the balance</option>
            {(sales.data?.items ?? [])
              .filter((x) => x.status === "confirmed")
              .map((x) => (
                <option key={x.id} value={x.id}>
                  Invoice {x.invoiceNo}, {formatDate(x.date)}, {formatMoney(x.totalPaisa)}
                </option>
              ))}
          </Select>
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
