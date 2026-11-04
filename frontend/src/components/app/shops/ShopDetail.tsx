"use client";

// One shop: its balance card, then tabs for the statement, sales, payments, returns, items taken
// and its details. The open tab and the statement's dates live in the address.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, buttonClass } from "@/components/ui/Button";
import { DateRangePicker, Tabs, type Range } from "@/components/ui/Controls";
import { Badge, Card, MoneyText, PageHeader, StatusBadge } from "@/components/ui/Display";
import { Checkbox, Input } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import type { ImageChange } from "@/components/ui/ImagePicker";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Table, type Column } from "@/components/ui/Table";
import { ApiError, type ShopCreateInput } from "@/lib/api/client";
import { creditUsage } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { firstIssue, temporaryPasswordField } from "@/lib/api/schemas";
import type { ItemTaken, Payment, Return, Sale, ShopWithBalance, StatementEntry } from "@/lib/api/types";
import { addDays, formatDate, formatDateTime, todayNepal } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { countUnits, plural } from "@/lib/units";
import { useUrlState } from "@/lib/url-state";
import { ShopForm } from "./ShopForm";
import { SHOP_AFFECTS, saveShop } from "./saveShop";

const TABS = [
  { id: "statement", label: "Statement" },
  { id: "sales", label: "Sales" },
  { id: "payments", label: "Payments" },
  { id: "returns", label: "Returns" },
  { id: "items", label: "Items taken" },
  { id: "details", label: "Details" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const plain = (paisa: number) => formatAmount(paisa).replace(/,/g, "");
const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function ShopDetail({ id }: { id: string }) {
  const q = useApiQuery(["shops", "detail", id], (api) => api.shops.get(id));
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  const [url, setUrl] = useUrlState(["tab", "from", "to"] as const);
  const tab: TabId = TABS.find((t) => t.id === url.tab)?.id ?? "statement";

  if (q.isPending) return <LoadingState label="Loading this shop" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/manager/shops" label="Shops" />
          <EmptyState title="This shop was not found" line="It may have been added in another browser. Go back to the shops." action={<Link href="/app/manager/shops" className={buttonClass("secondary", "sm")}>Back to shops</Link>} />
        </>
      );
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const shop = q.data;
  const route = routes.data?.find((r) => r.id === shop.routeId);
  const range: Range = { from: DATE.test(url.from) ? url.from : addDays(todayNepal(), -90), to: DATE.test(url.to) ? url.to : todayNepal() };

  const content = (t: TabId) => {
    if (t !== tab) return null;
    if (t === "statement") return <Statement shop={shop} range={range} onRange={(r) => setUrl({ from: r.from, to: r.to })} />;
    if (t === "sales") return <Sales shopId={shop.id} />;
    if (t === "payments") return <Payments shopId={shop.id} />;
    if (t === "returns") return <Returns shopId={shop.id} />;
    if (t === "items") return <Items shopId={shop.id} />;
    return <Details shop={shop} />;
  };

  return (
    <>
      <BackLink href="/app/manager/shops" label="Shops" />
      <PageHeader
        title={shop.name}
        lead={
          <>
            {shop.ownerName} · {route ? <Link href={`/app/manager/routes/${route.id}`} className="text-link">{route.name}</Link> : "On no route"}
          </>
        }
        actions={
          <>
            {shop.overduePaisa > 0 ? <StatusBadge status="overdue" /> : null}
            {shop.balancePaisa > shop.creditLimitPaisa ? <StatusBadge status="over_limit" /> : null}
            {shop.active ? <StatusBadge status="active" /> : <Badge tone="stopped">Inactive</Badge>}
          </>
        }
      />
      <BalanceCard shopId={shop.id} />
      <div className="mt-8">
        <Tabs label="About this shop" value={tab} onChange={(t) => setUrl({ tab: t === "statement" ? "" : t })} items={TABS.map((t) => ({ id: t.id, label: t.label, content: content(t.id) }))} />
      </div>
    </>
  );
}

// ---- balance ---------------------------------------------------------------------------------

function BalanceCard({ shopId }: { shopId: string }) {
  const q = useApiQuery(["shops", "balance", shopId], (api) => api.shops.balance(shopId));
  if (q.isPending) return <LoadingState label="Loading the balance" lines={3} />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const b = q.data;
  const use = creditUsage(b.balancePaisa, b.creditLimitPaisa);
  const bar = Math.min(100, use.percent ?? (use.usedPaisa > 0 ? 100 : 0));
  const rows: [string, number, string][] = [
    ["Opening balance", b.openingPaisa, ""],
    ["Sales", b.salesPaisa, "+"],
    ["Payments", b.paymentsPaisa, "−"],
    ["Returns", b.returnsPaisa, "−"],
  ];
  return (
    <Card as="section" aria-label="Balance" className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <dl className="m-0 lg:col-span-2">
        {rows.map(([label, paisa, sign]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule-2 py-2">
            <dt className="text-ink-2">{label}</dt>
            <dd className="m-0">
              <span className="mr-2 font-outlier text-muted" aria-hidden>
                {sign}
              </span>
              <MoneyText paisa={paisa} balance={label === "Opening balance"} />
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink py-3">
          <dt className="font-semibold">{b.balancePaisa < 0 ? "Credit" : "Owes"}</dt>
          <dd className="m-0 text-2xl">
            <MoneyText paisa={b.balancePaisa} balance />
          </dd>
        </div>
        <p className="mt-2 text-sm text-muted">Confirmed payments only. Cheques and online payments count once they clear.</p>
      </dl>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted">In clearing</p>
          <p className="mt-1 text-lg">
            <MoneyText paisa={b.inClearingPaisa} />
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Overdue</p>
          <p className={`mt-1 text-lg ${b.overduePaisa > 0 ? "text-warning" : ""}`}>
            <MoneyText paisa={b.overduePaisa} />
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Credit limit</p>
          <p className="mt-1 text-lg">
            <MoneyText paisa={b.creditLimitPaisa} />
          </p>
          <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="mt-2 block h-2 w-full" aria-hidden>
            <rect width="100" height="6" rx="3" className="fill-paper-3" />
            <rect width={bar} height="6" rx="3" className={use.over ? "fill-error" : "fill-accent-2"} />
          </svg>
          <p className={`mt-1.5 text-sm ${use.over ? "font-medium text-error" : "text-ink-2"}`}>
            {b.creditLimitPaisa === 0
              ? "No credit limit set."
              : use.over
                ? `Over the limit by Rs ${formatAmount(use.usedPaisa - b.creditLimitPaisa)}.`
                : `Rs ${formatAmount(use.usedPaisa)} used, ${use.percent}% of the limit.`}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---- statement ---------------------------------------------------------------------------------

const KIND: Record<StatementEntry["kind"], string> = { opening: "Opening", sale: "Sale", payment: "Payment", return: "Return" };

function Statement({ shop, range, onRange }: { shop: ShopWithBalance; range: Range; onRange: (r: Range) => void }) {
  const q = useApiQuery(["shops", "statement", shop.id, range], (api) => api.shops.statement(shop.id, range), { placeholderData: (prev) => prev });
  const columns: Column<StatementEntry>[] = [
    { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}</span>, csv: (e) => e.date },
    { key: "what", header: "Details", rowHeader: true, cell: (e) => <><span className="text-sm text-muted">{KIND[e.kind]} </span>{e.ref}</>, csv: (e) => `${KIND[e.kind]}: ${e.ref}` },
    { key: "debit", header: "Adds", numeric: true, cell: (e) => (e.debitPaisa ? <MoneyText paisa={e.debitPaisa} /> : null), csv: (e) => (e.debitPaisa ? plain(e.debitPaisa) : "") },
    { key: "credit", header: "Lowers", numeric: true, cell: (e) => (e.creditPaisa ? <MoneyText paisa={e.creditPaisa} /> : null), csv: (e) => (e.creditPaisa ? plain(e.creditPaisa) : "") },
    { key: "balance", header: "Balance", numeric: true, cell: (e) => <MoneyText paisa={e.balancePaisa} balance />, csv: (e) => plain(e.balancePaisa) },
  ];
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-4">
        <DateRangePicker value={range} onChange={onRange} />
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Print statement
        </Button>
      </div>
      <p className="mb-3 hidden text-sm print:block">
        Statement for {shop.name}, {formatDate(range.from)} to {formatDate(range.to)}. Printed {formatDateTime(new Date())}.
      </p>
      <Table
        caption={`Statement for ${shop.name}`}
        columns={columns}
        rows={q.data}
        rowKey={(e) => `${e.date}-${e.kind}-${e.ref}-${e.balancePaisa}`}
        loading={q.isPending}
        error={q.isError ? errorMessage(q.error) : null}
        onRetry={() => q.refetch()}
        empty={{ title: "Nothing in these dates", line: "Try a wider date range." }}
      />
      <p className="mt-3 text-sm text-muted">The opening balance is always shown first; the running balance includes everything before the range.</p>
    </div>
  );
}

// ---- sales, payments, returns, items -----------------------------------------------------------------

function useProductNames() {
  const q = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  return useMemo(() => new Map((q.data?.items ?? []).map((p) => [p.id, p])), [q.data]);
}

function Sales({ shopId }: { shopId: string }) {
  const q = useApiQuery(["sales", "list", { shopId }], (api) => api.sales.list({ shopId, pageSize: 200 }));
  const columns: Column<Sale>[] = [
    { key: "no", header: "Invoice", rowHeader: true, cell: (s) => <span className="font-outlier">{s.invoiceNo}</span>, sortValue: (s) => s.invoiceNo },
    { key: "date", header: "Date", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.date)}</span>, sortValue: (s) => s.date },
    { key: "items", header: "Items", numeric: true, cell: (s) => s.lines.length, sortValue: (s) => s.lines.length },
    { key: "total", header: "Total", numeric: true, cell: (s) => <MoneyText paisa={s.totalPaisa} />, sortValue: (s) => s.totalPaisa },
    { key: "due", header: "Due", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.dueDate)}</span>, sortValue: (s) => s.dueDate },
    { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];
  return <Table caption="Sales to this shop" columns={columns} rows={q.data?.items} rowKey={(s) => s.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "No sales yet", line: "Sales to this shop show up here." }} />;
}

const METHOD: Record<Payment["method"], string> = { cash: "Cash", cheque: "Cheque", online: "Online" };

function Payments({ shopId }: { shopId: string }) {
  const q = useApiQuery(["payments", "list", { shopId }], (api) => api.payments.list({ shopId, pageSize: 200 }));
  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", cell: (p) => <span className="whitespace-nowrap">{formatDate(p.date)}</span>, sortValue: (p) => p.date },
    { key: "method", header: "Method", rowHeader: true, cell: (p) => <>{METHOD[p.method]}{p.chequeNo ? <span className="text-sm text-muted"> · {p.chequeNo}</span> : null}</>, sortValue: (p) => p.method },
    { key: "amount", header: "Amount", numeric: true, cell: (p) => <MoneyText paisa={p.amountPaisa} />, sortValue: (p) => p.amountPaisa },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];
  return <Table caption="Payments from this shop" columns={columns} rows={q.data?.items} rowKey={(p) => p.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "No payments yet", line: "Payments from this shop show up here." }} />;
}

const REASON: Record<Return["lines"][number]["reason"], string> = { damaged: "damaged", expired: "expired", other: "other" };

function Returns({ shopId }: { shopId: string }) {
  const products = useProductNames();
  const q = useApiQuery(["returns", "list", { shopId }], (api) => api.returns.list({ shopId, pageSize: 200 }));
  const columns: Column<Return>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>, sortValue: (r) => r.date },
    {
      key: "items",
      header: "Items",
      rowHeader: true,
      cell: (r) => r.lines.map((l) => { const p = products.get(l.productId); return `${p ? countUnits(l.units, p.unitName) : l.units} of ${p?.name ?? "a product"} (${REASON[l.reason]})`; }).join("; "),
    },
    { key: "value", header: "Value", numeric: true, cell: (r) => <MoneyText paisa={r.valuePaisa} />, sortValue: (r) => r.valuePaisa },
  ];
  return <Table caption="Returns from this shop" columns={columns} rows={q.data?.items} rowKey={(r) => r.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "No returns", line: "Goods this shop sends back show up here." }} />;
}

function Items({ shopId }: { shopId: string }) {
  const products = useProductNames();
  const q = useApiQuery(["shops", "items", shopId], (api) => api.shops.itemsTaken(shopId));
  const name = (i: ItemTaken) => products.get(i.productId)?.name ?? "…";
  const columns: Column<ItemTaken>[] = [
    { key: "product", header: "Product", rowHeader: true, cell: name, sortValue: name },
    { key: "unit", header: "Sold as", cell: (i) => (i.unit === "carton" ? "Cartons" : capital(plural(products.get(i.productId)?.unitName ?? "unit"))), sortValue: (i) => i.unit },
    { key: "qty", header: "Quantity", numeric: true, cell: (i) => i.quantity, sortValue: (i) => i.quantity },
    { key: "base", header: "In units", numeric: true, cell: (i) => { const p = products.get(i.productId); return p ? countUnits(i.baseUnits, p.unitName) : i.baseUnits; }, sortValue: (i) => i.baseUnits },
    { key: "total", header: "Total", numeric: true, cell: (i) => <MoneyText paisa={i.totalPaisa} />, sortValue: (i) => i.totalPaisa },
  ];
  return (
    <>
      <p className="mb-3 text-sm text-ink-2">Everything this shop has bought, from confirmed sales. Cancelled sales are left out.</p>
      <Table caption="Items taken to date" columns={columns} rows={q.data} rowKey={(i) => `${i.productId}-${i.unit}`} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} empty={{ title: "Nothing taken yet", line: "Items show up here after the first sale." }} />
    </>
  );
}

// ---- details: edit, password, active ---------------------------------------------------------------

function Details({ shop }: { shop: ShopWithBalance }) {
  const toast = useToast();
  const update = useApiMutation((api, v: { input: ShopCreateInput; panPhoto: ImageChange }) => saveShop(api, v.input, v.panPhoto, shop.id), SHOP_AFFECTS);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-4 xl:items-start">
      <div className="xl:col-span-3">
        <ShopForm
          mode="edit"
          shop={shop}
          submitLabel="Save changes"
          onSave={async (input, panPhoto) => {
            const saved = await update.mutateAsync({ input, panPhoto });
            toast(input.temporaryPassword ? "Saved. Give the shop its temporary password in person." : "Changes saved.");
            return saved;
          }}
        />
      </div>
      <Access shop={shop} />
    </div>
  );
}

function Access({ shop }: { shop: ShopWithBalance }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const setActive = useApiMutation((api, active: boolean) => api.shops.update(shop.id, { active }), SHOP_AFFECTS);
  const toggle = async () => {
    try {
      await setActive.mutateAsync(!shop.active);
      toast(shop.active ? `${shop.name} deactivated.` : `${shop.name} is active again.`);
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      setConfirming(false);
    }
  };
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Access</h2>
      <dl className="m-0 mt-4 flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-muted">Login</dt>
          <dd className="m-0 mt-0.5 break-words">{shop.hasLogin ? shop.loginEmail : "No login yet"}</dd>
        </div>
        {shop.hasLogin ? (
          <div>
            <dt className="text-muted">Temporary password set</dt>
            <dd className="m-0 mt-0.5">{shop.passwordResetAt ? formatDateTime(shop.passwordResetAt) : "Not since it was added"}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-5 flex flex-col gap-3 border-t border-rule-2 pt-4">
        {shop.hasLogin ? (
          <Button variant="secondary" onClick={() => setResetting(true)}>
            Reset password
          </Button>
        ) : (
          <p className="text-sm text-ink-2">Give the shop a login in the form, under Login.</p>
        )}
        {shop.active ? (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Deactivate
          </Button>
        ) : (
          <Button variant="secondary" loading={setActive.isPending} loadingLabel="Activating…" onClick={toggle}>
            Activate again
          </Button>
        )}
        <p className="text-sm text-muted">Shops are never deleted. Demo: sign-in uses the test accounts, so login changes here do not affect who can sign in.</p>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={toggle}
        busy={setActive.isPending}
        danger
        title={`Deactivate ${shop.name}?`}
        consequence="It will not be visited or sold to, and its login stops working. Its balance, sales and payments stay as they are, and you can activate it again later."
        confirmLabel="Deactivate"
      />
      <ResetPassword shop={shop} open={resetting} onClose={() => setResetting(false)} />
    </Card>
  );
}

type ResetValues = { temporaryPassword: string; repeat: string };

function ResetPassword({ shop, open, onClose }: { shop: ShopWithBalance; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<ResetValues>({ defaultValues: { temporaryPassword: "", repeat: "" } });
  const resetPassword = useApiMutation((api, pw: string) => api.shops.resetPassword(shop.id, pw), SHOP_AFFECTS);
  const close = () => {
    reset();
    setProblem(null);
    setShow(false);
    onClose();
  };
  const onSubmit = handleSubmit(async (v) => {
    setProblem(null);
    const checked = temporaryPasswordField.safeParse(v.temporaryPassword);
    if (!checked.success) return setError("temporaryPassword", { message: firstIssue(checked.error) }, { shouldFocus: true });
    if (v.repeat !== v.temporaryPassword) return setError("repeat", { message: "The two passwords do not match." }, { shouldFocus: true });
    try {
      await resetPassword.mutateAsync(v.temporaryPassword);
      close();
      toast(`Temporary password set. Give it to ${shop.name} in person.`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={close}
      title={`Reset ${shop.name}'s password`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Go back
          </Button>
          <Button type="submit" form="reset-shop-password" loading={formState.isSubmitting} loadingLabel="Setting…">
            Set temporary password
          </Button>
        </>
      }
    >
      <form id="reset-shop-password" onSubmit={onSubmit} noValidate>
        <p className="mb-4 text-ink-2">The old password stops working. Type a temporary one and give it to the shop in person.</p>
        <Input label="Temporary password" type={show ? "text" : "password"} autoComplete="new-password" hint="At least 8 characters." error={formState.errors.temporaryPassword?.message} {...register("temporaryPassword")} />
        <Input label="Type it again" type={show ? "text" : "password"} autoComplete="new-password" error={formState.errors.repeat?.message} {...register("repeat")} />
        <Checkbox label="Show passwords" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <FormProblem message={problem} />
      </form>
    </Modal>
  );
}
