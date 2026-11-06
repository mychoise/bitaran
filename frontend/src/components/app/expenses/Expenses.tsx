"use client";

// The business's expenses: a filtered table with a totals row, a form to add or edit one
// (salary for a staff member and the month it covers; fuel and khaja optionally on a day plan;
// an optional bill photo), and totals by type and month with a chart.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart } from "@/components/ui/BarChart";
import { Button, buttonClass } from "@/components/ui/Button";
import { DateRangePicker, ImageViewer, Segmented, type Range } from "@/components/ui/Controls";
import { Card, MoneyText, PageHeader } from "@/components/ui/Display";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ImagePicker, type ImageChange } from "@/components/ui/ImagePicker";
import { useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { ApiError, type ExpenseUpdate } from "@/lib/api/client";
import { checkExpense } from "@/lib/api/mock/rules";
import { errorMessage, useApi, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Expense, ExpenseType } from "@/lib/api/types";
import { addDays, formatDate, formatDateTime, formatMonth, todayNepal } from "@/lib/dates";
import { formatAmount, formatMoney, parseRupees } from "@/lib/money";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { EXPENSE_TYPE } from "../labels";
import { DateFilter, okDate } from "../records/filters";
import { newKey } from "../salesman/onVisit";

const TYPES = ["salary", "fuel", "khaja", "misc"] as const;
const AFFECTS = [["expenses"], ["reports"]];
const csvAmount = (paisa: number) => formatAmount(paisa).replace(/,/g, "");

function PersonFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const look = usePlanLookups();
  return (
    <div className="lg:w-52">
      <Select label="Person" size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Everyone</option>
        {look.staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName}
          </option>
        ))}
      </Select>
    </div>
  );
}

function TypeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="lg:w-44">
      <Select label="Type" size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {EXPENSE_TYPE[t]}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ---- list ----------------------------------------------------------------------------------------

export function ExpenseList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["from", "to", "type", "person", "sort"] as const);
  const type = TYPES.find((t) => t === url.type);
  const filter = useMemo(() => ({ from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, type, staffId: url.person || undefined, pageSize: 200 }), [url.from, url.to, type, url.person]);
  const q = useApiQuery(["expenses", "list", filter], (api) => api.expenses.list(filter), { placeholderData: (prev) => prev });
  const filtered = Boolean(url.from || url.to || type || url.person);
  const items = q.data?.items;
  const total = (items ?? []).reduce((a, e) => a + e.amountPaisa, 0);

  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", cell: (e) => <Link href={`/app/manager/expenses/${e.id}`} className="text-link whitespace-nowrap">{formatDate(e.date)}</Link>, sortValue: (e) => e.date, csv: (e) => e.date },
    { key: "type", header: "Type", rowHeader: true, cell: (e) => EXPENSE_TYPE[e.type], sortValue: (e) => EXPENSE_TYPE[e.type] },
    { key: "person", header: "Person", cell: (e) => look.person(e.staffId), sortValue: (e) => look.person(e.staffId) },
    {
      key: "for",
      header: "For",
      cell: (e) => (e.salaryMonth ? formatMonth(e.salaryMonth) : e.planId ? <Link href={`/app/manager/day-plans/${e.planId}`} className="text-link">Day plan</Link> : <span className="text-muted">·</span>),
      csv: (e) => (e.salaryMonth ? formatMonth(e.salaryMonth) : e.planId ? `Day plan ${e.planId}` : ""),
    },
    { key: "note", header: "Description", cell: (e) => <span className="block max-w-xs truncate">{e.note || <span className="text-muted">·</span>}</span>, csv: (e) => e.note },
    { key: "bill", header: "Bill photo", csvOnly: true, cell: () => null, csv: (e) => (e.billImageId ? "yes" : "no") },
    { key: "amount", header: "Amount", numeric: true, cell: (e) => <MoneyText paisa={e.amountPaisa} />, sortValue: (e) => e.amountPaisa, csv: (e) => csvAmount(e.amountPaisa) },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        lead="Salary, fuel, khaja and everything else the business spends."
        actions={
          <>
            <Link href="/app/manager/expenses/summary" className={buttonClass("secondary", "sm")}>
              Summary
            </Link>
            <ExportButton filename="expenses.csv" columns={columns} rows={items} />
            <Link href="/app/manager/expenses/new" className={buttonClass("primary", "sm")}>
              New expense
            </Link>
          </>
        }
      />
      <div className="no-print mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
        <TypeFilter value={type ?? ""} onChange={(v) => setUrl({ type: v })} />
        <PersonFilter value={url.person} onChange={(v) => setUrl({ person: v })} />
        {filtered ? (
          <div className="flex items-end self-stretch pb-7">
            <Button variant="quiet" size="sm" onClick={() => setUrl({ from: "", to: "", type: "", person: "" })}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </div>
      {q.data && q.data.total > q.data.items.length ? (
        <p className="mb-3 text-sm text-muted">
          Showing the newest {q.data.items.length} of {q.data.total}. The total is for these rows; narrow the dates to see the rest.
        </p>
      ) : null}
      <Table
        caption="Expenses"
        columns={columns}
        rows={items}
        rowKey={(e) => e.id}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        sort={parseSort(url.sort)}
        onSortChange={(s) => setUrl({ sort: formatSort(s) })}
        totals={{ label: `Total, ${items?.length ?? 0} expense${items?.length === 1 ? "" : "s"}`, cells: { amount: <MoneyText paisa={total} /> } }}
        empty={filtered ? { title: "No expenses match", line: "Try other filters." } : { title: "No expenses yet", line: "Add salary, fuel, khaja and other spending here." }}
      />
    </>
  );
}

// ---- add and edit --------------------------------------------------------------------------------

/** The month before today's, "YYYY-MM": the usual month a salary covers. */
const lastMonth = () => addDays(`${todayNepal().slice(0, 7)}-01`, -1).slice(0, 7);

export function NewExpense() {
  return (
    <>
      <BackLink href="/app/manager/expenses" label="Expenses" />
      <PageHeader title="New expense" />
      <ExpenseForm />
    </>
  );
}

export function ExpenseDetail({ id }: { id: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["expenses", "detail", id], (api) => api.expenses.get(id));
  if (q.isPending) return <LoadingState label="Loading the expense" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return <EmptyState title="This expense was not found" line="Go back to the expenses." action={<Link href="/app/manager/expenses" className={buttonClass("secondary", "sm")}>Back to expenses</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const e = q.data;
  return (
    <>
      <BackLink href="/app/manager/expenses" label="Expenses" />
      <PageHeader title={`${EXPENSE_TYPE[e.type]}, ${formatMoney(e.amountPaisa)}`} lead={`${look.person(e.staffId)} · ${formatDate(e.date)}`} />
      <p className="mb-6 max-w-3xl rounded-input border border-rule-2 bg-paper-3 p-3 text-sm">
        No history of edits is kept yet: saving replaces what is here.
        {e.createdBy ? ` Added by ${look.person(e.createdBy)}${e.createdAt ? `, ${formatDateTime(e.createdAt)}` : ""}.` : ""}
        {e.updatedAt && e.updatedBy ? ` Last changed by ${look.person(e.updatedBy)}, ${formatDateTime(e.updatedAt)}.` : ""}
      </p>
      <ExpenseForm key={e.updatedAt ?? e.id} existing={e} />
    </>
  );
}

function ExpenseForm({ existing }: { existing?: Expense }) {
  const { viewer } = useApi();
  const look = usePlanLookups();
  const router = useRouter();
  const toast = useToast();
  const today = todayNepal();
  const [key] = useState(newKey);
  const [type, setType] = useState<ExpenseType>(existing?.type ?? "fuel");
  const [amount, setAmount] = useState(existing ? formatAmount(existing.amountPaisa).replace(/,/g, "") : "");
  const [date, setDate] = useState(existing?.date ?? today);
  const [staffId, setStaffId] = useState(existing?.staffId ?? "");
  const [planId, setPlanId] = useState(existing?.planId ?? "");
  const [month, setMonth] = useState(existing?.salaryMonth ?? lastMonth());
  const [note, setNote] = useState(existing?.note ?? "");
  const [bill, setBill] = useState<ImageChange>({ kind: "keep" });
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const onPlan = type === "fuel" || type === "khaja";
  const plans = useApiQuery(["dayPlans", "list", { salesmanId: staffId }], (api) => api.dayPlans.list({ salesmanId: staffId, pageSize: 200 }), { enabled: onPlan && Boolean(staffId) });

  const save = useApiMutation(async (api, v: { input: Omit<Parameters<typeof api.expenses.create>[0], "billImageId" | "idempotencyKey">; bill: ImageChange }) => {
    const uploaded = v.bill.kind === "new" ? (await api.uploads.image(v.bill.blob)).id : undefined;
    if (!existing) return api.expenses.create({ ...v.input, idempotencyKey: key, billImageId: uploaded });
    const patch: ExpenseUpdate = { ...v.input, staffId: v.input.staffId ?? existing.staffId, planId: v.input.planId ?? null, salaryMonth: v.input.salaryMonth ?? null };
    if (v.bill.kind !== "keep") patch.billImageId = uploaded ?? null;
    return api.expenses.update(existing.id, patch);
  }, AFFECTS);

  const amountPaisa = parseRupees(amount);
  const input = {
    type,
    amountPaisa: amountPaisa ?? 0,
    date,
    note,
    staffId: staffId || undefined,
    planId: onPlan && planId ? planId : undefined,
    salaryMonth: type === "salary" ? month : undefined,
  };
  const ruleProblem = amountPaisa === null ? "Enter the amount in rupees, like 450." : checkExpense(input, { id: viewer.id, role: viewer.type === "staff" ? viewer.role : "salesman" }, today);
  const fieldOf = (p: string | null) =>
    !p ? null : /amount/i.test(p) ? "amount" : /staff member/.test(p) ? "staff" : /month/.test(p) ? "month" : /day still to come|date/i.test(p) ? "date" : /note/.test(p) ? "note" : "form";
  const shown = tried ? ruleProblem : null;
  const at = fieldOf(shown);

  const submit = async () => {
    setTried(true);
    if (ruleProblem) return;
    setProblem(null);
    try {
      const saved = await save.mutateAsync({ input, bill });
      toast(existing ? "Expense saved." : `${EXPENSE_TYPE[type]} expense added.`);
      if (!existing) router.push(`/app/manager/expenses/${saved.id}`);
      else setBill({ kind: "keep" });
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  const planOptions = (plans.data?.items ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      {look.error || plans.isError ? (
        <div className="lg:col-span-3">
          <ErrorState
            message={`The staff or day plan lists did not load. ${errorMessage(look.error ?? plans.error)}`}
            onRetry={() => {
              look.retry();
              if (plans.isError) plans.refetch();
            }}
          />
        </div>
      ) : null}
      <Card as="section" className="lg:col-span-2" aria-label="Expense">
        <Segmented
          label="Type of expense"
          value={type}
          onChange={(t) => {
            setType(t);
            if (t !== "fuel" && t !== "khaja") setPlanId("");
          }}
          options={TYPES.map((t) => ({ value: t, label: EXPENSE_TYPE[t] }))}
        />
        <div className="mt-6 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Input label="Amount (Rs)" inputMode="decimal" autoComplete="off" value={amount} error={at === "amount" ? shown! : undefined} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Date" type="date" max={today} value={date} error={at === "date" ? shown! : undefined} onChange={(e) => setDate(e.target.value)} />
          <Select
            label="Staff member"
            hint={type === "salary" ? "Who the salary is for." : "Optional. Left empty, it is recorded under you."}
            value={staffId}
            error={at === "staff" ? shown! : undefined}
            onChange={(e) => {
              setStaffId(e.target.value);
              setPlanId("");
            }}
          >
            <option value="">{type === "salary" ? "Choose a person" : "No one in particular"}</option>
            {look.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
          {type === "salary" ? (
            <Input label="Month it covers" type="month" value={month} max={today.slice(0, 7)} error={at === "month" ? shown! : undefined} onChange={(e) => setMonth(e.target.value)} />
          ) : onPlan ? (
            <Select label="Day plan (optional)" hint={staffId ? "The day it was spent on." : "Choose the staff member first."} value={planId} disabled={!staffId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Not on a day plan</option>
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatDate(p.date)}, {look.route(p.routeId)?.name ?? ""}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        <Textarea label="Description" hint="Optional, up to 300 characters." value={note} error={at === "note" ? shown! : undefined} onChange={(e) => setNote(e.target.value)} />
        <FormProblem message={problem ?? (at === "form" ? shown : null)} />
        <Button className="mt-2" loading={save.isPending} loadingLabel="Saving…" onClick={submit}>
          {existing ? "Save changes" : "Add expense"}
        </Button>
      </Card>
      <div className="flex flex-col gap-4">
        <ImagePicker
          title="Bill photo"
          alt="Bill for this expense"
          current={existing?.billImageUrl}
          change={bill}
          onChange={setBill}
          hint="Optional. PNG, JPEG or WebP, under 5 MB."
          emptyText="No bill photo"
          maxPx={1600}
          pendingText={existing ? "saved when you save changes" : "saved with the expense"}
        />
        {existing?.billImageUrl && bill.kind === "keep" ? (
          <Card dense>
            <p className="mb-2 text-sm text-ink-2">Open the bill to look closely.</p>
            <ImageViewer src={existing.billImageUrl} alt="Bill for this expense" />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ---- summary -------------------------------------------------------------------------------------

type MonthRow = { month: string; totalPaisa: number; byType: Record<ExpenseType, number> };

export function ExpenseSummaryView() {
  const today = todayNepal();
  const [url, setUrl] = useUrlState(["from", "to", "type", "person"] as const);
  // By default: the start of the month five months back, to today.
  const fallback: Range = { from: `${addDays(today, -150).slice(0, 7)}-01`, to: today };
  const range: Range = { from: okDate(url.from) || fallback.from, to: okDate(url.to) || fallback.to };
  const type = TYPES.find((t) => t === url.type);
  const filter = useMemo(() => ({ from: range.from, to: range.to, type, staffId: url.person || undefined }), [range.from, range.to, type, url.person]);
  const q = useApiQuery(["expenses", "summary", filter], (api) => api.expenses.summary(filter), { placeholderData: (prev) => prev });

  const monthColumns: Column<MonthRow>[] = [
    { key: "month", header: "Month", rowHeader: true, cell: (m) => formatMonth(m.month), sortValue: (m) => m.month, csv: (m) => m.month },
    ...TYPES.map((t): Column<MonthRow> => ({ key: t, header: EXPENSE_TYPE[t], numeric: true, cell: (m) => <MoneyText paisa={m.byType[t]} />, sortValue: (m) => m.byType[t], csv: (m) => csvAmount(m.byType[t]) })),
    { key: "total", header: "Total", numeric: true, cell: (m) => <MoneyText paisa={m.totalPaisa} />, sortValue: (m) => m.totalPaisa, csv: (m) => csvAmount(m.totalPaisa) },
  ];
  const d = q.data;

  return (
    <>
      <BackLink href="/app/manager/expenses" label="Expenses" />
      <PageHeader
        title="Expense summary"
        lead={`${formatDate(range.from)} to ${formatDate(range.to)}`}
        actions={
          <>
            <ExportButton filename={`expenses-by-month-${range.from}-${range.to}.csv`} columns={monthColumns} rows={d?.byMonth} />
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />
      <div className="no-print mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <DateRangePicker value={range} onChange={(r) => setUrl({ from: r.from, to: r.to })} />
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex">
          <TypeFilter value={type ?? ""} onChange={(v) => setUrl({ type: v })} />
          <PersonFilter value={url.person} onChange={(v) => setUrl({ person: v })} />
        </div>
      </div>
      {q.isPending ? (
        <LoadingState label="Adding up the expenses" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : d!.count === 0 ? (
        <EmptyState title="No expenses in these dates" line="Try a wider date range." />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <Card dense>
              <dt className="text-sm text-muted">Total</dt>
              <dd className="m-0 mt-1 font-outlier text-xl whitespace-nowrap">{formatMoney(d!.totalPaisa)}</dd>
              <dd className="m-0 text-sm text-ink-2">
                {d!.count} expense{d!.count === 1 ? "" : "s"}
              </dd>
            </Card>
            {d!.byType.map((t) => (
              <Card key={t.type} dense>
                <dt className="text-sm text-muted">{EXPENSE_TYPE[t.type]}</dt>
                <dd className="m-0 mt-1 font-outlier text-xl whitespace-nowrap">{formatMoney(t.amountPaisa)}</dd>
                <dd className="m-0 text-sm text-ink-2">
                  {t.count} expense{t.count === 1 ? "" : "s"}
                </dd>
              </Card>
            ))}
          </dl>
          <Card as="section" dense className="mt-6" aria-label="Expenses by month">
            <BarChart
              title={type ? `${EXPENSE_TYPE[type]} by month` : "Expenses by month"}
              valueLabel="Expenses"
              bars={d!.byMonth.map((m) => ({ key: m.month, label: formatMonth(m.month), value: m.totalPaisa, display: formatMoney(m.totalPaisa) }))}
            />
          </Card>
          <h2 className="mt-8 mb-3 text-title tracking-normal">By month and type</h2>
          <Table
            caption="Expenses by month and type"
            columns={monthColumns}
            rows={d!.byMonth}
            rowKey={(m) => m.month}
            totals={{ label: "Total", cells: { ...Object.fromEntries(d!.byType.map((t) => [t.type, <MoneyText key={t.type} paisa={t.amountPaisa} />])), total: <MoneyText paisa={d!.totalPaisa} /> } }}
          />
        </>
      )}
    </>
  );
}
