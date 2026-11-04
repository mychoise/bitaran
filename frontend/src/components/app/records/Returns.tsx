"use client";

// Returns: goods back from shops. A manager can record one for a shop directly (choosing the
// credited value, unlike a salesman). Write-offs: stock that is lost, from the warehouse or from
// a day plan.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, PageHeader } from "@/components/ui/Display";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ExportButton, Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { checkReturnLines, checkWriteOff, lineUnits, returnValue } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Return, ReturnReason, SaleUnit, WriteOff } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { WHOLE } from "@/lib/forms";
import { formatAmount, parseRupees } from "@/lib/money";
import { countUnits, plural } from "@/lib/units";
import { formatSort, parseSort, useUrlState } from "@/lib/url-state";
import { usePlanLookups } from "../dayplans/lookups";
import { newKey } from "../salesman/onVisit";
import { DateFilter, okDate } from "./filters";

const REASON: Record<ReturnReason, string> = { damaged: "Damaged", expired: "Expired", other: "Other" };
const plain = (p: number) => formatAmount(p).replace(/,/g, "");

// ---- returns -----------------------------------------------------------------------------------

export function ReturnList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["from", "to", "shop", "sort"] as const);
  const filter = useMemo(() => ({ from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, shopId: url.shop || undefined, pageSize: 200 }), [url.from, url.to, url.shop]);
  const q = useApiQuery(["returns", "list", filter], (api) => api.returns.list(filter), { placeholderData: (prev) => prev });
  const items = (r: Return) => r.lines.map((l) => `${countUnits(l.units, look.product(l.productId)?.unitName ?? "unit")} ${look.product(l.productId)?.name ?? ""} (${REASON[l.reason].toLowerCase()})`).join("; ");
  const columns: Column<Return>[] = [
    { key: "date", header: "Date", cell: (r) => <Link href={`/app/manager/returns/${r.id}`} className="text-link whitespace-nowrap">{formatDate(r.date)}</Link>, sortValue: (r) => r.createdAt, csv: (r) => r.date },
    { key: "shop", header: "Shop", rowHeader: true, cell: (r) => look.shop(r.shopId)?.name ?? "…", sortValue: (r) => look.shop(r.shopId)?.name ?? "" },
    { key: "items", header: "Items", cell: items, csv: items },
    { key: "by", header: "Recorded by", cell: (r) => look.person(r.salesmanId), sortValue: (r) => look.person(r.salesmanId) },
    { key: "value", header: "Credited", numeric: true, cell: (r) => <MoneyText paisa={r.valuePaisa} />, sortValue: (r) => r.valuePaisa, csv: (r) => plain(r.valuePaisa) },
  ];
  return (
    <>
      <PageHeader
        title="Returns"
        lead="Goods back from shops, credited to what they owe."
        actions={
          <>
            <Link href="/app/manager/write-offs" className={buttonClass("secondary", "sm")}>
              Write-offs
            </Link>
            <ExportButton filename="returns.csv" columns={columns} rows={q.data?.items} />
            <Link href="/app/manager/returns/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-4" />
              New return
            </Link>
          </>
        }
      />
      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
        <div className="lg:w-56">
          <Select label="Shop" size="sm" value={url.shop} onChange={(e) => setUrl({ shop: e.target.value })}>
            <option value="">All shops</option>
            {look.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Table caption="Returns" columns={columns} rows={q.data?.items} rowKey={(r) => r.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} sort={parseSort(url.sort)} onSortChange={(s) => setUrl({ sort: formatSort(s) })} empty={{ title: "No returns", line: "Goods shops send back show up here." }} />
    </>
  );
}

export function ReturnDetail({ id }: { id: string }) {
  const look = usePlanLookups();
  const q = useApiQuery(["returns", "detail", id], (api) => api.returns.get(id));
  if (q.isPending) return <LoadingState label="Loading the return" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "not_found") return <EmptyState title="This return was not found" line="Go back to the returns." action={<Link href="/app/manager/returns" className={buttonClass("secondary", "sm")}>Back to returns</Link>} />;
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const r = q.data;
  const shop = look.shop(r.shopId);
  return (
    <>
      <BackLink href="/app/manager/returns" label="Returns" />
      <PageHeader title={`Return from ${shop?.name ?? "…"}`} lead={formatDateTime(r.createdAt)} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <Card as="section" dense className="lg:col-span-2" aria-label="Items">
          <ul className="m-0 list-none p-0">
            {r.lines.map((l, i) => {
              const p = look.product(l.productId);
              return (
                <li key={i} className="flex justify-between gap-3 border-t border-rule-2 py-2.5 first:border-t-0">
                  <span>
                    <span className="block font-medium">{p?.name ?? "…"}</span>
                    <span className="block text-sm text-muted">
                      {countUnits(l.units, p?.unitName ?? "unit")} · {REASON[l.reason]} · {l.restocked ? "back into stock" : "not put back into stock"}
                    </span>
                  </span>
                  <MoneyText paisa={l.valuePaisa} />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex justify-between border-t-2 border-ink pt-2 font-semibold">
            <span>Credited to the shop</span>
            <MoneyText paisa={r.valuePaisa} />
          </p>
        </Card>
        <Card as="section" dense aria-label="Where it came from">
          <dl className="m-0 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted">Shop</dt>
              <dd className="m-0 mt-0.5">{shop ? <Link href={`/app/manager/shops/${shop.id}?tab=returns`} className="text-link">{shop.name}</Link> : "…"}</dd>
            </div>
            <div>
              <dt className="text-muted">Recorded by</dt>
              <dd className="m-0 mt-0.5">{look.person(r.salesmanId)}</dd>
            </div>
            <div>
              <dt className="text-muted">On</dt>
              <dd className="m-0 mt-0.5">{r.planId ? <Link href={`/app/manager/day-plans/${r.planId}`} className="text-link">A salesman&apos;s day plan</Link> : "Recorded at the office"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}

type Line = { units: string; reason: ReturnReason; restock: boolean; value: string };

export function NewReturnManager() {
  const look = usePlanLookups();
  const router = useRouter();
  const toast = useToast();
  const [shopId, setShopId] = useState("");
  const [key] = useState(newKey);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const returnable = useApiQuery(["shops", "returnable", shopId || "none"], (api) => api.shops.returnable(shopId), { enabled: Boolean(shopId) });
  const create = useApiMutation((api, input: Parameters<typeof api.returns.create>[0]) => api.returns.create(input), [["returns"], ["shops"], ["products"], ["reports"]]);
  const can = new Map((returnable.data ?? []).map((r) => [r.productId, r.units]));
  const chosen = Object.entries(lines)
    .map(([productId, l]) => ({ productId, l, units: WHOLE.test(l.units) ? Number(l.units) : 0 }))
    .filter((x) => x.units > 0);
  const valueOf = (x: (typeof chosen)[number]) => parseRupees(x.l.value) ?? returnValue(x.units, look.product(x.productId)!);
  const problems = checkReturnLines(chosen.map((x) => ({ productId: x.productId, units: x.units, reason: x.l.reason, restock: x.l.restock })), look.products, (pid) => can.get(pid) ?? 0);
  const badValue = chosen.some((x) => x.l.value.trim() !== "" && parseRupees(x.l.value) === null);
  const total = chosen.reduce((a, x) => a + valueOf(x), 0);
  const set = (pid: string, patch: Partial<Line>) => {
    const cur = lines[pid] ?? { units: "", reason: "damaged" as ReturnReason, restock: false, value: "" };
    const next = { ...cur, ...patch };
    if (next.reason !== "other") next.restock = false;
    setLines({ ...lines, [pid]: next });
  };

  const submit = async () => {
    setProblem(null);
    try {
      const r = await create.mutateAsync({
        idempotencyKey: key,
        shopId,
        lines: chosen.map((x) => ({ productId: x.productId, units: x.units, reason: x.l.reason, restock: x.l.restock, valuePaisa: x.l.value.trim() ? parseRupees(x.l.value)! : undefined })),
      });
      toast("Return recorded.");
      router.push(`/app/manager/returns/${r.id}`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <BackLink href="/app/manager/returns" label="Returns" />
      <PageHeader title="New return" lead="Goods a shop sends back, recorded at the office. The credit lowers what the shop owes." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card as="section" dense aria-label="Shop">
            <Select
              label="Shop"
              value={shopId}
              onChange={(e) => {
                setShopId(e.target.value);
                setLines({});
              }}
            >
              <option value="">Choose a shop</option>
              {look.shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Card>
          {shopId ? (
            returnable.isPending ? (
              <LoadingState label="Loading what this shop bought" />
            ) : returnable.isError ? (
              <ErrorState message={errorMessage(returnable.error)} onRetry={() => returnable.refetch()} />
            ) : (returnable.data ?? []).length === 0 ? (
              <EmptyState title="Nothing to return" line="This shop has not bought anything, or everything has already come back." />
            ) : (
              <Card as="section" dense aria-label="Items">
                <ul className="m-0 list-none p-0">
                  {(returnable.data ?? []).map((r) => {
                    const p = look.product(r.productId);
                    if (!p) return null;
                    const l = lines[p.id] ?? { units: "", reason: "damaged" as ReturnReason, restock: false, value: "" };
                    const units = WHOLE.test(l.units) ? Number(l.units) : 0;
                    return (
                      <li key={p.id} className="grid grid-cols-1 gap-x-4 border-t border-rule-2 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-4">
                        <div className="sm:col-span-4">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-muted">Can return up to {countUnits(r.units, p.unitName)}</p>
                        </div>
                        <Input label={`How many (${plural(p.unitName)})`} size="sm" inputMode="numeric" autoComplete="off" value={l.units} onChange={(e) => set(p.id, { units: e.target.value })} />
                        <Select label="Why" size="sm" value={l.reason} onChange={(e) => set(p.id, { reason: e.target.value as ReturnReason })}>
                          {(["damaged", "expired", "other"] as const).map((x) => (
                            <option key={x} value={x}>
                              {REASON[x]}
                            </option>
                          ))}
                        </Select>
                        <Input label="Credit (Rs)" size="sm" inputMode="decimal" autoComplete="off" placeholder={units ? formatAmount(returnValue(units, p)) : ""} hint="Leave empty for the price." value={l.value} onChange={(e) => set(p.id, { value: e.target.value })} />
                        <div className="pt-8">{l.reason === "other" ? <Checkbox label="Back into stock" checked={l.restock} onChange={(e) => set(p.id, { restock: e.target.checked })} /> : <p className="text-sm text-ink-2">Not put back into stock.</p>}</div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )
          ) : null}
        </div>
        <Card as="section" dense aria-label="Summary" className="lg:sticky lg:top-24">
          <p className="text-sm text-muted">Credited to the shop</p>
          <p className="mt-1 font-outlier text-2xl">
            <MoneyText paisa={total} />
          </p>
          {shopId && look.shop(shopId) ? (
            <p className="mt-2 text-sm text-ink-2">
              Owes <MoneyText paisa={look.shop(shopId)!.balancePaisa} /> now, <MoneyText paisa={look.shop(shopId)!.balancePaisa - total} /> after.
            </p>
          ) : null}
          <FormProblem message={problem ?? (chosen.length && problems.length ? problems[0] : badValue ? "Enter credits in rupees, or leave them empty." : null)} />
          <Button className="mt-4 w-full" disabled={!shopId || chosen.length === 0 || problems.length > 0 || badValue} loading={create.isPending} loadingLabel="Saving…" onClick={submit}>
            Record return
          </Button>
        </Card>
      </div>
    </>
  );
}

// ---- write-offs --------------------------------------------------------------------------------

export function WriteOffList() {
  const look = usePlanLookups();
  const [url, setUrl] = useUrlState(["from", "to", "sort"] as const);
  const filter = useMemo(() => ({ from: okDate(url.from) || undefined, to: okDate(url.to) || undefined, pageSize: 200 }), [url.from, url.to]);
  const q = useApiQuery(["writeOffs", "list", filter], (api) => api.writeOffs.list(filter), { placeholderData: (prev) => prev });
  const columns: Column<WriteOff>[] = [
    { key: "date", header: "Date", cell: (w) => <span className="whitespace-nowrap">{formatDate(w.date)}</span>, sortValue: (w) => w.date, csv: (w) => w.date },
    { key: "product", header: "Product", rowHeader: true, cell: (w) => look.product(w.productId)?.name ?? "…", sortValue: (w) => look.product(w.productId)?.name ?? "" },
    { key: "qty", header: "Quantity", numeric: true, cell: (w) => countUnits(w.units, look.product(w.productId)?.unitName ?? "unit"), sortValue: (w) => w.units, csv: (w) => w.units },
    { key: "reason", header: "Reason", cell: (w) => REASON[w.reason], sortValue: (w) => w.reason },
    { key: "from", header: "From", cell: (w) => (w.planId ? <Link href={`/app/manager/day-plans/${w.planId}`} className="text-link">A day plan</Link> : "Warehouse"), sortValue: (w) => (w.planId ? 1 : 0), csv: (w) => (w.planId ? "Day plan" : "Warehouse") },
    { key: "note", header: "Note", cell: (w) => <span className="text-ink-2">{w.note}</span>, csv: (w) => w.note },
    { key: "by", header: "By", cell: (w) => look.person(w.createdBy), sortValue: (w) => look.person(w.createdBy) },
  ];
  return (
    <>
      <PageHeader
        title="Write-offs"
        lead="Stock that is lost: damaged, expired or missing."
        actions={
          <>
            <Link href="/app/manager/returns" className={buttonClass("secondary", "sm")}>
              Returns
            </Link>
            <ExportButton filename="write-offs.csv" columns={columns} rows={q.data?.items} />
            <Link href="/app/manager/write-offs/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-4" />
              New write-off
            </Link>
          </>
        }
      />
      <div className="mb-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start">
        <DateFilter from={okDate(url.from)} to={okDate(url.to)} onChange={setUrl} />
      </div>
      <Table caption="Write-offs" columns={columns} rows={q.data?.items} rowKey={(w) => w.id} loading={q.isPending} error={q.isError ? errorMessage(q.error) : null} onRetry={() => q.refetch()} sort={parseSort(url.sort)} onSortChange={(s) => setUrl({ sort: formatSort(s) })} empty={{ title: "No write-offs", line: "Stock written off shows up here." }} />
    </>
  );
}

export function NewWriteOff() {
  const look = usePlanLookups();
  const router = useRouter();
  const toast = useToast();
  const [key] = useState(newKey);
  const plans = useApiQuery(["dayPlans", "list", "open"], (api) => api.dayPlans.list({ pageSize: 200 }));
  const offs = useApiQuery(["writeOffs", "list", "all"], (api) => api.writeOffs.list({ pageSize: 200 }));
  const sales = useApiQuery(["sales", "list", "all"], (api) => api.sales.list({ pageSize: 200 }));
  const [productId, setProductId] = useState("");
  const [unit, setUnit] = useState<SaleUnit>("unit");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [note, setNote] = useState("");
  const [planId, setPlanId] = useState("");
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useApiMutation((api, input: Parameters<typeof api.writeOffs.create>[0]) => api.writeOffs.create(input), [["writeOffs"], ["products"], ["dayPlans"], ["reports"]]);

  const product = look.product(productId);
  const plan = plans.data?.items.find((p) => p.id === planId) ?? null;
  const open = (plans.data?.items ?? []).filter((p) => p.status === "in_progress" || p.status === "closed");
  const qty = WHOLE.test(quantity) ? Number(quantity) : 0;
  const units = product ? lineUnits({ unit, quantity: qty }, product) : null;
  const ruleProblem = !product ? "Choose a product." : units === null ? `${product.name} is not sold by the carton.` : checkWriteOff({ units, reason, note }, product, plan, sales.data?.items ?? [], offs.data?.items ?? []);

  const submit = async () => {
    setTried(true);
    if (ruleProblem) return;
    setProblem(null);
    try {
      await create.mutateAsync({ idempotencyKey: key, productId, unit, quantity: qty, reason, note, planId: planId || undefined });
      toast("Write-off recorded.");
      router.push("/app/manager/write-offs");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <BackLink href="/app/manager/write-offs" label="Write-offs" />
      <PageHeader title="New write-off" lead="Stock that cannot be sold or was lost." />
      <Card as="section" className="max-w-3xl" aria-label="Write-off">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product</option>
              {look.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({countUnits(p.stockUnits, p.unitName)} in the warehouse)
                </option>
              ))}
            </Select>
          </div>
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as SaleUnit)}>
            <option value="unit">Pieces{product ? ` (${plural(product.unitName)})` : ""}</option>
            {product?.unitsPerCarton ? <option value="carton">Cartons of {product.unitsPerCarton}</option> : null}
          </Select>
          <Input label="Quantity" inputMode="numeric" autoComplete="off" value={quantity} hint={product && units && unit === "carton" ? `= ${countUnits(units, product.unitName)}` : undefined} onChange={(e) => setQuantity(e.target.value)} />
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
            {(["damaged", "expired", "other"] as const).map((x) => (
              <option key={x} value={x}>
                {REASON[x]}
              </option>
            ))}
          </Select>
          <Select label="Day plan (optional)" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">From the warehouse</option>
            {open.map((p) => (
              <option key={p.id} value={p.id}>
                {formatDate(p.date)}, {look.person(p.salesmanId)}, {look.route(p.routeId)?.name ?? ""}
              </option>
            ))}
          </Select>
        </div>
        <p className="mb-4 rounded-input border border-rule-2 bg-paper-3 p-3 text-sm">
          {planId
            ? "With a day plan, the stock already left the warehouse when it was issued, so the warehouse is not reduced again. It counts against that plan, and its reconcile expects that much less back."
            : "From the warehouse: the warehouse stock goes down by this much."}
        </p>
        <Textarea label="Note" hint="Optional. What happened." value={note} onChange={(e) => setNote(e.target.value)} />
        <FormProblem message={problem ?? (tried ? ruleProblem : null)} />
        <Button className="mt-2" loading={create.isPending} loadingLabel="Saving…" onClick={submit}>
          Record write-off
        </Button>
      </Card>
    </>
  );
}
