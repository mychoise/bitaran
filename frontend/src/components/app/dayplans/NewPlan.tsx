"use client";

// A new day plan: a salesman, a route and a date, then the stock to issue. Each line is pieces
// or cartons; the warehouse stock is shown beside it and over-issuing is refused as you type.
// A summary of what will be issued comes before the confirm step.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import type { IssueLineInput } from "@/lib/api/client";
import { canPlanFor, checkIssue, lineUnits, planClash } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Product, SaleUnit } from "@/lib/api/types";
import { formatDate, todayNepal } from "@/lib/dates";
import { WHOLE } from "@/lib/forms";
import { cartonEquivalent, countUnits, plural } from "@/lib/units";
import { usePlanLookups } from "./lookups";

type Line = { key: number; productId: string; unit: SaleUnit; quantity: string };

export function NewPlan() {
  const router = useRouter();
  const toast = useToast();
  const look = usePlanLookups();
  const stock = useApiQuery(["products", "list", "stock"], (api) => api.products.list({ pageSize: 200, active: true }));
  const [salesmanId, setSalesmanId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [date, setDate] = useState(todayNepal());
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sameDay = useApiQuery(["dayPlans", "list", { from: date, to: date }], (api) => api.dayPlans.list({ from: date, to: date, pageSize: 200 }), { enabled: /^\d{4}-\d{2}-\d{2}$/.test(date) });
  const create = useApiMutation((api, input: { date: string; salesmanId: string; routeId: string; lines: IssueLineInput[] }) => api.dayPlans.create(input), [["dayPlans"], ["products"], ["reports"]]);

  const products = useMemo(() => stock.data?.items ?? [], [stock.data]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const route = look.route(routeId);
  const salesman = look.salesmen.find((s) => s.id === salesmanId);
  const today = todayNepal();
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const dateText = dateOk ? formatDate(date) : "that date";

  // The live check: quantities as numbers, then the same rule the server uses.
  const asInput: IssueLineInput[] = lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: WHOLE.test(l.quantity) ? Number(l.quantity) : Number.NaN }));
  const check = checkIssue(asInput, products);
  const lineProblem = (i: number) => check.problems.find((p) => p.index === i)?.message;
  const clash = salesmanId && routeId && sameDay.data ? planClash(sameDay.data.items, { salesmanId, routeId, date }) : false;
  const fieldProblems = {
    salesman: !salesmanId ? "Choose a salesman." : undefined,
    route: !routeId ? "Choose a route." : route && route.shopIds.length === 0 ? "This route has no shops yet. Add shops to it first." : clash ? `${salesman?.fullName ?? "This salesman"} already has a plan for this route on ${dateText}.` : undefined,
    date: !dateOk ? "Choose a date." : !canPlanFor(date, today) ? "Plans are for today or a day ahead." : undefined,
  };
  const ready = !fieldProblems.salesman && !fieldProblems.route && !fieldProblems.date && check.problems.length === 0;

  const term = search.trim().toLowerCase();
  const matches = term ? products.filter((p) => (p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)) && !lines.some((l) => l.productId === p.id)).slice(0, 6) : [];

  const add = (p: Product) => {
    setLines([...lines, { key: nextKey, productId: p.id, unit: p.unitsPerCarton ? "carton" : "unit", quantity: "" }]);
    setNextKey(nextKey + 1);
    setSearch("");
  };
  const update = (key: number, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onIssue = async () => {
    setProblem(null);
    try {
      const plan = await create.mutateAsync({ date, salesmanId, routeId, lines: asInput });
      setConfirming(false);
      toast(`Plan made. The stock is issued to ${salesman?.fullName ?? "the salesman"}.`);
      router.push(`/app/manager/day-plans/${plan.id}`);
    } catch (e) {
      setConfirming(false);
      setProblem(errorMessage(e));
    }
  };

  if (stock.isPending || !look.ready) return <LoadingState label="Loading salesmen, routes and stock" />;
  if (stock.isError) return <ErrorState message={errorMessage(stock.error)} onRetry={() => stock.refetch()} />;
  const show = (m?: string) => (tried ? m : undefined);
  const totalUnits = [...check.totals.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <BackLink href="/app/manager/day-plans" label="Day plans" />
      <PageHeader title="New day plan" lead="Who goes where, and the stock they carry. Issuing takes the stock out of the warehouse." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card as="section" dense>
            <h2 className="text-title tracking-normal">Salesman, route and date</h2>
            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3">
              <Select label="Salesman" value={salesmanId} error={show(fieldProblems.salesman)} onChange={(e) => setSalesmanId(e.target.value)}>
                <option value="">Choose a salesman</option>
                {look.salesmen.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.active}>
                    {s.fullName}
                    {s.active ? "" : " (inactive)"}
                  </option>
                ))}
              </Select>
              <Select label="Route" value={routeId} error={fieldProblems.route && (tried || clash || (route && route.shopIds.length === 0)) ? fieldProblems.route : undefined} onChange={(e) => setRouteId(e.target.value)}>
                <option value="">Choose a route</option>
                {look.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.shopIds.length} shop{r.shopIds.length === 1 ? "" : "s"})
                  </option>
                ))}
              </Select>
              <Input label="Date" type="date" min={today} value={date} error={fieldProblems.date && (tried || date < today) ? fieldProblems.date : undefined} onChange={(e) => setDate(e.target.value)} />
            </div>
          </Card>

          <Card as="section" dense>
            <h2 className="text-title tracking-normal">Stock to issue</h2>
            <div className="mt-4 max-w-xl">
              <Input label="Find a product" type="search" size="sm" placeholder="Name or SKU" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} />
              {term ? (
                matches.length ? (
                  <ul className="m-0 -mt-4 mb-4 list-none rounded-input border border-rule-2 p-0" aria-label="Matching products">
                    {matches.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 border-t border-rule-2 px-3 py-2 first:border-t-0">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block text-sm text-muted">
                            {p.sku} · {countUnits(p.stockUnits, p.unitName)} in the warehouse
                          </span>
                        </span>
                        <Button variant="secondary" size="sm" icon={<PlusIcon className="size-4" />} disabled={p.stockUnits === 0} onClick={() => add(p)}>
                          {p.stockUnits === 0 ? "None left" : "Add"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="-mt-4 mb-4 text-sm text-ink-2">No active product matches, or it is already on the list.</p>
                )
              ) : null}
            </div>

            {lines.length === 0 ? (
              <p className={`text-sm ${tried ? "font-medium text-error" : "text-ink-2"}`}>{tried ? "Add at least one product to issue." : "Search for a product to add it."}</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {lines.map((l, i) => {
                  const p = byId.get(l.productId);
                  if (!p) return null;
                  const units = WHOLE.test(l.quantity) ? lineUnits({ unit: l.unit, quantity: Number(l.quantity) }, p) : null;
                  const err = lineProblem(i);
                  return (
                    <li key={l.key} className="grid grid-cols-1 gap-x-4 border-t border-rule-2 pt-4 sm:grid-cols-6">
                      <div className="sm:col-span-2">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted">
                          In the warehouse: {countUnits(p.stockUnits, p.unitName)}
                          {cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName) ? ` (${cartonEquivalent(p.stockUnits, p.unitsPerCarton, p.unitName)})` : ""}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <Select label="Unit" size="sm" value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value as SaleUnit })}>
                          <option value="unit">Pieces ({plural(p.unitName)})</option>
                          {p.unitsPerCarton ? <option value="carton">Cartons of {p.unitsPerCarton}</option> : null}
                        </Select>
                      </div>
                      <div className="sm:col-span-1">
                        <Input
                          label="Quantity"
                          size="sm"
                          inputMode="numeric"
                          autoComplete="off"
                          value={l.quantity}
                          error={err && (tried || l.quantity !== "") ? err : undefined}
                          hint={!err && units !== null && l.unit === "carton" ? `= ${countUnits(units, p.unitName)}` : undefined}
                          onChange={(e) => update(l.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="flex items-start pt-8 sm:col-span-1 sm:justify-end">
                        <Button variant="quiet" size="sm" aria-label={`Remove ${p.name}`} icon={<CloseIcon className="size-4" />} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card as="section" dense className="lg:sticky lg:top-24" aria-label="Summary">
          <h2 className="text-title tracking-normal">What will be issued</h2>
          <dl className="m-0 mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Salesman</dt>
              <dd className="m-0 text-right">{salesman?.fullName ?? "Not chosen"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Route</dt>
              <dd className="m-0 text-right">{route ? `${route.name}, ${route.shopIds.length} shop${route.shopIds.length === 1 ? "" : "s"}` : "Not chosen"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Date</dt>
              <dd className="m-0 text-right">{dateOk ? dateText : "Not chosen"}</dd>
            </div>
          </dl>
          {check.totals.size ? (
            <ul className="m-0 mt-4 list-none border-t border-rule-2 p-0 pt-3 text-sm">
              {[...check.totals].map(([pid, units]) => {
                const p = byId.get(pid)!;
                return (
                  <li key={pid} className="flex justify-between gap-3 py-1">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 text-right font-outlier">
                      {countUnits(units, p.unitName)}
                      {cartonEquivalent(units, p.unitsPerCarton, p.unitName) ? <span className="block text-xs text-muted">{cartonEquivalent(units, p.unitsPerCarton, p.unitName)}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 border-t border-rule-2 pt-3 text-sm text-ink-2">No stock added yet.</p>
          )}
          <p className="mt-3 text-sm text-ink-2">
            {check.totals.size} product{check.totals.size === 1 ? "" : "s"}, {totalUnits} units in all.
          </p>
          <FormProblem message={problem} />
          <Button
            className="mt-4 w-full"
            onClick={() => {
              setTried(true);
              if (ready) setConfirming(true);
            }}
          >
            Issue stock and make the plan
          </Button>
          <Link href="/app/manager/day-plans" className={buttonClass("quiet", "md", "mt-2 w-full")}>
            Cancel
          </Link>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onIssue}
        busy={create.isPending}
        title={`Issue this stock to ${salesman?.fullName ?? "the salesman"}?`}
        consequence={`${check.totals.size} product${check.totals.size === 1 ? "" : "s"} leave the warehouse now, for ${route?.name ?? "the route"} on ${dateText}. Until the day starts you can delete the plan and get the stock back.`}
        confirmLabel="Issue stock"
      />
    </>
  );
}
