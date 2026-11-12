"use client";

// My expenses: add fuel, khaja or miscellaneous spending (amount, date, note, an optional bill
// photo), and see my own list. Salary is added by the manager.

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Camera, type Shot } from "@/components/ui/Camera";
import { Segmented } from "@/components/ui/Controls";
import { Card, MoneyText } from "@/components/ui/Display";
import { Input, Textarea } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { checkExpense } from "@/lib/api/mock/rules";
import { errorMessage, useApi, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { ExpenseType } from "@/lib/api/types";
import { formatDate, todayNepal } from "@/lib/dates";
import { formatMoney, parseRupees } from "@/lib/money";
import { useOnceKey, useSingleFlight } from "./onVisit";

export function Expenses() {
  const t = useTranslations("Salesman.expenses");
  const tCommon = useTranslations("Ui.Common");
  const TYPES: { value: Exclude<ExpenseType, "salary">; label: string }[] = [
    { value: "fuel", label: t("types.fuel") },
    { value: "khaja", label: t("types.khaja") },
    { value: "misc", label: t("types.other") },
  ];
  const LABEL: Record<ExpenseType, string> = { fuel: t("types.fuel"), khaja: t("types.khaja"), misc: t("types.other"), salary: t("types.salary") };
  const { viewer } = useApi();
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const today = todayNepal();
  const list = useApiQuery(["expenses", "list", "mine"], (api) => api.expenses.list({ pageSize: 100 }));
  const [type, setType] = useState<Exclude<ExpenseType, "salary">>("fuel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [bill, setBill] = useState<Shot | null>(null);
  const [withBill, setWithBill] = useState(false);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useApiMutation(async (api, v: { shot: Shot | null; input: Omit<Parameters<typeof api.expenses.create>[0], "billImageId"> }) => {
    const billImageId = v.shot ? (await api.uploads.image(v.shot.blob)).id : undefined;
    return api.expenses.create({ ...v.input, billImageId });
  }, [["expenses"], ["reports"]]);

  const amountPaisa = parseRupees(amount);
  const ruleProblem = checkExpense({ type, amountPaisa: amountPaisa ?? 0, date, note }, { id: viewer.id, role: viewer.type === "staff" ? viewer.role : "salesman" }, today);

  const submit = () => single(async () => {
    setTried(true);
    if (amountPaisa === null || ruleProblem) return;
    setProblem(null);
    try {
      await create.mutateAsync({ shot: withBill ? bill : null, input: { idempotencyKey: key, type, amountPaisa, date, note } });
      renew();
      toast(t("addedToast", { type: LABEL[type] }));
      setAmount("");
      setNote("");
      setBill(null);
      setWithBill(false);
      setTried(false);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });

  const items = list.data?.items ?? [];
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-display-s">{t("title")}</h1>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card as="section" dense aria-labelledby="add-title">
          <h2 id="add-title" className="text-title tracking-normal">
            {t("addTitle")}
          </h2>
          <div className="mt-4">
            <Segmented label={t("kindLabel")} value={type} onChange={setType} options={TYPES} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Input label={t("amountLabel")} inputMode="decimal" autoComplete="off" value={amount} error={tried && (amountPaisa === null || ruleProblem === "Enter an amount above zero.") ? t("amountError") : undefined} onChange={(e) => setAmount(e.target.value)} />
            <Input label={t("dateLabel")} type="date" max={today} value={date} error={tried && ruleProblem && ruleProblem !== "Enter an amount above zero." && !ruleProblem.includes("note") ? ruleProblem : undefined} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Textarea label={t("noteLabel")} hint={t("noteHint")} value={note} error={note.length > 300 ? "Keep the note under 300 characters." : undefined} onChange={(e) => setNote(e.target.value)} />
          {withBill ? (
            <Camera label={t("billPhotoLabel")} shot={bill} onShot={setBill} />
          ) : (
            <Button variant="quiet" size="sm" onClick={() => setWithBill(true)}>
              {t("addBillPhoto")}
            </Button>
          )}
          <FormProblem message={problem} />
          <Button size="lg" className="mt-4 w-full" loading={create.isPending} loadingLabel={tCommon("saving")} onClick={submit}>
            {t("addButton")}
          </Button>
          <p className="mt-2 text-sm text-muted">{t("salaryNote")}</p>
        </Card>

        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="text-title tracking-normal">
            {t("myListTitle")}
          </h2>
          {list.isPending ? (
            <LoadingState label={t("loadingExpenses")} lines={3} />
          ) : list.isError ? (
            <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState title={t("noExpensesTitle")} line={t("noExpensesLine")} />
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-2">{t("summary", { count: items.length, total: formatMoney(items.reduce((a, e) => a + e.amountPaisa, 0)) })}</p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {items.map((e) => (
                  <li key={e.id}>
                    <Card dense className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {LABEL[e.type]}
                          {e.billImageId ? <span className="text-sm font-normal text-muted">{t("billPhotoSuffix")}</span> : null}
                        </span>
                        <span className="block text-sm text-muted">
                          {formatDate(e.date)}
                          {e.note ? ` · ${e.note}` : ""}
                        </span>
                      </span>
                      <MoneyText paisa={e.amountPaisa} />
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
