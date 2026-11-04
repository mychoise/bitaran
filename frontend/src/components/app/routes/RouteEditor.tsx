"use client";

// One route: rename it, and set its shops in visiting order. Shops move with the up and down
// buttons (keyboard and screen readers) or by dragging. Nothing is saved until "Save order",
// which replaces the route's whole list. A shop added here leaves its old route.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, MoneyText, PageHeader } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/components/ui/icons";
import { ConfirmDialog, useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { moveItem } from "@/lib/api/mock/rules";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { routeNameField } from "@/lib/api/schemas";
import type { Route, ShopWithBalance } from "@/lib/api/types";
import { zodResolver } from "@/lib/forms";

const AFFECTS = [["routes"], ["shops"]];

export function RouteEditor({ id }: { id: string }) {
  const route = useApiQuery(["routes", "detail", id], (api) => api.routes.get(id));
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());

  if (route.isPending || shops.isPending) return <LoadingState label="Loading this route" />;
  if (route.isError) {
    if (route.error instanceof ApiError && route.error.code === "not_found")
      return (
        <>
          <BackLink href="/app/manager/routes" label="Routes" />
          <EmptyState title="This route was not found" line="It may have been deleted. Go back to the routes." action={<Link href="/app/manager/routes" className={buttonClass("secondary", "sm")}>Back to routes</Link>} />
        </>
      );
    return <ErrorState message={errorMessage(route.error)} onRetry={() => route.refetch()} />;
  }
  if (shops.isError) return <ErrorState message={errorMessage(shops.error)} onRetry={() => shops.refetch()} />;
  return (
    <>
      <BackLink href="/app/manager/routes" label="Routes" />
      <PageHeader title={route.data.name} lead={`${route.data.shopIds.length} shop${route.data.shopIds.length === 1 ? "" : "s"} in visiting order`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ShopOrder key={route.data.shopIds.join(",")} route={route.data} shops={shops.data.items} routes={routes.data ?? []} />
        </div>
        <div className="flex flex-col gap-6">
          <Rename route={route.data} />
          <DeleteRoute route={route.data} />
        </div>
      </div>
    </>
  );
}

// ---- the ordered shops ------------------------------------------------------------------------

function ShopOrder({ route, shops, routes }: { route: Route; shops: ShopWithBalance[]; routes: Route[] }) {
  const toast = useToast();
  const [order, setOrder] = useState<string[]>(route.shopIds);
  const [adding, setAdding] = useState("");
  const [said, setSaid] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  /** The row being dragged, read at drop time (state may not have re-rendered yet). */
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const focusNext = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const save = useApiMutation((api, ids: string[]) => api.routes.setShops(route.id, ids), AFFECTS);

  const byId = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);
  const routeName = (rid: string | null) => routes.find((r) => r.id === rid)?.name;
  const dirty = order.join(",") !== route.shopIds.join(",");
  const movingIn = order.filter((sid) => byId.get(sid)?.routeId && byId.get(sid)?.routeId !== route.id).length;
  const droppedOut = route.shopIds.filter((sid) => !order.includes(sid)).length;
  const candidates = shops.filter((s) => s.active && !order.includes(s.id));

  // After a keyboard move, keep focus on the same button of the shop that moved.
  useEffect(() => {
    if (!focusNext.current) return;
    buttons.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  }, [order]);

  const move = (from: number, to: number, how?: "up" | "down") => {
    const next = moveItem(order, from, to);
    if (next.join(",") === order.join(",")) return;
    const name = byId.get(order[from])?.name ?? "The shop";
    setOrder(next);
    setSaid(`${name} is now number ${to + 1} of ${next.length}.`);
    if (how) {
      // At either end the button it used is gone, so focus the other one.
      const end = (how === "up" && to === 0) || (how === "down" && to === next.length - 1);
      focusNext.current = `${order[from]}:${end ? (how === "up" ? "down" : "up") : how}`;
    }
  };

  const onSave = async () => {
    setProblem(null);
    try {
      await save.mutateAsync(order);
      toast("Route saved.");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  return (
    <Card as="section" dense>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-title tracking-normal">Shops in visiting order</h2>
        <p className="text-sm text-muted">Move with the arrows, or drag a shop.</p>
      </div>

      {order.length === 0 ? (
        <p className="mt-4 text-ink-2">No shops on this route yet. Add the first one below.</p>
      ) : (
        <ol className="m-0 mt-4 list-none p-0">
          {order.map((sid, i) => {
            const s = byId.get(sid);
            const from = s?.routeId && s.routeId !== route.id ? routeName(s.routeId) : null;
            return (
              <li
                key={sid}
                draggable
                onDragStart={(e) => {
                  dragFrom.current = i;
                  setDragging(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", sid);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom.current !== null) move(dragFrom.current, i);
                  dragFrom.current = null;
                  setDragging(null);
                  setOver(null);
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDragging(null);
                  setOver(null);
                }}
                data-dragging={dragging === i || undefined}
                data-over={over === i && dragging !== i ? true : undefined}
                className="route-row flex cursor-grab items-center gap-3 border-t border-rule-2 py-2.5 active:cursor-grabbing"
              >
                <span className="w-6 text-right font-outlier text-muted" aria-hidden>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s?.name ?? "Unknown shop"}</span>
                  <span className="block truncate text-sm text-muted">
                    {s?.address}
                    {from ? ` · moves here from ${from}` : null}
                  </span>
                </span>
                <span className="hidden text-sm sm:block">{s ? <MoneyText paisa={s.balancePaisa} balance /> : null}</span>
                <span className="flex items-center gap-1">
                  <Button
                    ref={(el) => {
                      buttons.current.set(`${sid}:up`, el);
                    }}
                    variant="quiet"
                    size="sm"
                    className="px-2"
                    aria-label={`Move ${s?.name ?? "shop"} up`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1, "up")}
                  >
                    <ChevronUpIcon className="size-4" />
                  </Button>
                  <Button
                    ref={(el) => {
                      buttons.current.set(`${sid}:down`, el);
                    }}
                    variant="quiet"
                    size="sm"
                    className="px-2"
                    aria-label={`Move ${s?.name ?? "shop"} down`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, i + 1, "down")}
                  >
                    <ChevronDownIcon className="size-4" />
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    className="px-2"
                    aria-label={`Remove ${s?.name ?? "shop"} from this route`}
                    onClick={() => {
                      setOrder(order.filter((x) => x !== sid));
                      setSaid(`${s?.name ?? "The shop"} removed from the route.`);
                    }}
                  >
                    <CloseIcon className="size-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule-2 pt-4">
        <div className="min-w-60 flex-1">
          <Select label="Add a shop" size="sm" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose a shop</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.routeId ? ` (now on ${routeName(s.routeId) ?? "another route"})` : " (on no route)"}
              </option>
            ))}
          </Select>
        </div>
        <div className="pb-7">
          <Button
            variant="secondary"
            size="sm"
            disabled={!adding}
            onClick={() => {
              setOrder([...order, adding]);
              setSaid(`${byId.get(adding)?.name ?? "The shop"} added at the end.`);
              setAdding("");
            }}
          >
            Add to the end
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-rule-2 pt-4">
        <Button loading={save.isPending} loadingLabel="Saving…" disabled={!dirty} onClick={onSave}>
          Save order
        </Button>
        {dirty ? (
          <Button
            variant="quiet"
            onClick={() => {
              setOrder(route.shopIds);
              setSaid("Changes undone.");
            }}
          >
            Undo changes
          </Button>
        ) : null}
        {dirty ? (
          <p className="text-sm text-ink-2">
            Not saved yet.
            {movingIn ? ` ${movingIn} shop${movingIn === 1 ? "" : "s"} will leave ${movingIn === 1 ? "its" : "their"} old route.` : ""}
            {droppedOut ? ` ${droppedOut} shop${droppedOut === 1 ? "" : "s"} will be on no route.` : ""}
          </p>
        ) : null}
      </div>
      <FormProblem message={problem} />
    </Card>
  );
}

// ---- name and delete --------------------------------------------------------------------------

const nameSchema = z.object({ name: routeNameField });
type NameValues = z.infer<typeof nameSchema>;

function Rename({ route }: { route: Route }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<NameValues>({ resolver: zodResolver(nameSchema), values: { name: route.name } });
  const rename = useApiMutation((api, name: string) => api.routes.update(route.id, { name }), AFFECTS);
  const onSubmit = handleSubmit(async ({ name }) => {
    setProblem(null);
    try {
      const saved = await rename.mutateAsync(name);
      reset({ name: saved.name });
      toast("Name saved.");
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Name</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4">
        <Input label="Route name" autoComplete="off" error={formState.errors.name?.message} {...register("name")} />
        <Button type="submit" variant="secondary" size="sm" loading={formState.isSubmitting} loadingLabel="Saving…" disabled={!formState.isDirty}>
          Save name
        </Button>
        <FormProblem message={problem} />
      </form>
    </Card>
  );
}

function DeleteRoute({ route }: { route: Route }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const remove = useApiMutation((api) => api.routes.remove(route.id), [["routes"]]);
  const onConfirm = async () => {
    try {
      await remove.mutateAsync(undefined);
      toast(`${route.name} deleted.`);
      router.push("/app/manager/routes");
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      setOpen(false);
    }
  };
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Delete</h2>
      {route.shopIds.length > 0 ? (
        <p className="mt-2 text-sm text-ink-2">A route with shops cannot be deleted. Remove its shops and save first.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">Only a route no day plan has used can be deleted. Otherwise rename it.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(true)}>
            Delete route
          </Button>
        </>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        busy={remove.isPending}
        danger
        title={`Delete ${route.name}?`}
        consequence="It has no shops, so no shop changes. This cannot be undone."
        confirmLabel="Delete route"
      />
    </Card>
  );
}
