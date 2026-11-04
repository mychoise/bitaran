"use client";

// Goods coming back from a shop. The shop's past purchases are listed, each with how many can
// still come back. For each: how many and why (damaged, expired, other). The credit is the
// product's price, shown but not changeable here; the effect on the shop's balance is summed up.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText } from "@/components/ui/Display";
import { Checkbox, Select } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Overlay";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { checkReturnLines, returnValue } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import type { Return, ReturnReason, VisitShop } from "@/lib/api/types";
import { formatMoney } from "@/lib/money";
import { countUnits, plural } from "@/lib/units";
import { useOnceKey, useSingleFlight, VisitGate } from "./onVisit";
import { DAY_AFFECTS } from "./useToday";

type Line = { units: number; reason: ReturnReason; restock: boolean };
const REASONS: { value: ReturnReason; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "other", label: "Other" },
];

export function NewReturn() {
  return <VisitGate title="Return goods">{(v) => <ReturnForm v={v} />}</VisitGate>;
}

function ReturnForm({ v }: { v: VisitShop }) {
  const toast = useToast();
  const { key, renew } = useOnceKey();
  const single = useSingleFlight();
  const returnable = useApiQuery(["shops", "returnable", v.shop.id], (api) => api.shops.returnable(v.shop.id));
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Return | null>(null);
  const create = useApiMutation((api, input: Parameters<typeof api.returns.create>[0]) => api.returns.create(input), DAY_AFFECTS);

  // What can come back: bought less already returned, worked out on the server from every record.
  const can = useMemo(() => new Map((returnable.data ?? []).map((r) => [r.productId, r.units])), [returnable.data]);

  if (returnable.isPending || products.isPending) return <LoadingState label="Loading what this shop bought" />;
  if (returnable.isError) return <ErrorState message={errorMessage(returnable.error)} onRetry={() => returnable.refetch()} />;
  const byId = new Map((products.data?.items ?? []).map((p) => [p.id, p]));
  const rows = [...can].filter(([, n]) => n > 0).map(([productId, most]) => ({ product: byId.get(productId)!, most })).filter((r) => r.product);
  const chosen = Object.entries(lines).filter(([, l]) => l.units > 0);
  const credit = chosen.reduce((a, [pid, l]) => a + returnValue(l.units, byId.get(pid)!), 0);
  const problems = checkReturnLines(chosen.map(([productId, l]) => ({ productId, ...l })), [...byId.values()], (pid) => can.get(pid) ?? 0);

  if (done)
    return (
      <Card as="section" aria-label="Return recorded">
        <p className="text-sm text-muted">Return recorded</p>
        <p className="mt-1 font-outlier text-display-s">{formatMoney(done.valuePaisa)}</p>
        <p className="mt-2 text-ink-2">Credited to {v.shop.name}. {done.lines.some((l) => l.restocked) ? "Goods fine to sell again go back into stock." : "Damaged and expired goods are not put back into stock."}</p>
        <Link href={`/app/salesman/shops/${v.visit.id}`} className={buttonClass("primary", "lg", "mt-6 w-full")}>
          Back to {v.shop.name}
        </Link>
      </Card>
    );

  const set = (pid: string, patch: Partial<Line>) => {
    const cur = lines[pid] ?? { units: 0, reason: "damaged" as ReturnReason, restock: false };
    const next = { ...cur, ...patch };
    if (next.reason !== "other") next.restock = false;
    setLines({ ...lines, [pid]: next });
  };

  const submit = () => single(async () => {
    setProblem(null);
    try {
      const r = await create.mutateAsync({ idempotencyKey: key, visitId: v.visit.id, lines: chosen.map(([productId, l]) => ({ productId, ...l })) });
      renew();
      toast(`Return of ${formatMoney(r.valuePaisa)} recorded.`);
      setDone(r);
    } catch (e) {
      setProblem(errorMessage(e));
    }
   });

  return (
    <div className="flex flex-col gap-6">
      {rows.length === 0 ? (
        <Card dense>
          <p className="text-ink-2">This shop has nothing to return: it has not bought anything yet, or everything has come back already.</p>
        </Card>
      ) : (
        <section aria-labelledby="bought-title">
          <h2 id="bought-title" className="text-title tracking-normal">
            What this shop bought
          </h2>
          <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
            {rows.map(({ product: p, most }) => {
              const l = lines[p.id] ?? { units: 0, reason: "damaged" as ReturnReason, restock: false };
              return (
                <li key={p.id}>
                  <Card dense className={l.units > 0 ? "ring-2 ring-ink" : ""}>
                    <p className="text-lg font-medium">{p.name}</p>
                    <p className="text-sm text-muted">Can return up to {countUnits(most, p.unitName)}</p>
                    <div className="mt-3 flex flex-wrap items-end gap-4">
                      <div className="flex items-center gap-3">
                        <Button variant="secondary" size="lg" className="w-14 px-0" aria-label={`One fewer ${p.name}`} disabled={l.units === 0} onClick={() => set(p.id, { units: l.units - 1 })}>
                          <MinusIcon className="size-6" />
                        </Button>
                        <span className="w-12 text-center font-outlier text-2xl" aria-label={`${l.units} ${plural(p.unitName)} of ${p.name}`}>
                          {l.units}
                        </span>
                        <Button variant="secondary" size="lg" className="w-14 px-0" aria-label={`One more ${p.name}`} disabled={l.units >= most} onClick={() => set(p.id, { units: l.units + 1 })}>
                          <PlusIcon className="size-6" />
                        </Button>
                      </div>
                      {l.units > 0 ? (
                        <div className="min-w-40 flex-1">
                          <Select label="Why" size="sm" value={l.reason} onChange={(e) => set(p.id, { reason: e.target.value as ReturnReason })}>
                            {REASONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ) : null}
                    </div>
                    {l.units > 0 ? (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                        {l.reason === "other" ? <Checkbox label="Fine to sell again" hint="It goes back into stock." checked={l.restock} onChange={(e) => set(p.id, { restock: e.target.checked })} /> : <p className="text-sm text-ink-2">{l.reason === "damaged" ? "Damaged" : "Expired"} goods never go back into stock.</p>}
                        <p className="text-right">
                          <span className="block text-sm text-muted">Credited</span>
                          <MoneyText paisa={returnValue(l.units, p)} />
                        </p>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {chosen.length ? (
        <Card as="section" dense aria-label="Effect on the balance">
          <dl className="m-0 flex flex-col gap-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">{v.shop.balancePaisa < 0 ? "Credit now" : "Owes now"}</dt>
              <dd className="m-0">
                <MoneyText paisa={Math.abs(v.shop.balancePaisa)} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Credited for this return</dt>
              <dd className="m-0">
                <MoneyText paisa={-credit} />
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-rule-2 pt-1.5 font-semibold">
              <dt>{v.shop.balancePaisa - credit < 0 ? "Credit after" : "Owes after"}</dt>
              <dd className="m-0">
                <MoneyText paisa={Math.abs(v.shop.balancePaisa - credit)} />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">Credits use each product&apos;s price. Only a manager can change them.</p>
        </Card>
      ) : null}

      <FormProblem message={problem ?? (chosen.length && problems.length ? problems[0] : null)} />
      <Button size="lg" className="w-full" disabled={chosen.length === 0 || problems.length > 0} loading={create.isPending} loadingLabel="Saving…" onClick={submit}>
        Record return
      </Button>
    </div>
  );
}
