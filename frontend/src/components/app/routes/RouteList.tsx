"use client";

// Routes: each route with its shops in visiting order. Add a route here; open one to rename it,
// order its shops, or add and remove shops.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { FormProblem } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { routeNameField } from "@/lib/api/schemas";
import { zodResolver } from "@/lib/forms";

const nameSchema = z.object({ name: routeNameField });
type NameValues = z.infer<typeof nameSchema>;

export function RouteList() {
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  const shopName = useMemo(() => new Map((shops.data?.items ?? []).map((s) => [s.id, s.name])), [shops.data]);
  const unrouted = shops.data?.items.filter((s) => s.routeId === null && s.active).length ?? 0;

  return (
    <>
      <PageHeader title="Routes" lead="The shops each salesman rides to, in visiting order." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <section aria-label="All routes" className="lg:col-span-2">
          {routes.isPending ? (
            <LoadingState label="Loading routes" />
          ) : routes.isError ? (
            <ErrorState message={errorMessage(routes.error)} onRetry={() => routes.refetch()} />
          ) : routes.data.length === 0 ? (
            <EmptyState title="No routes yet" line="Add your first route, then put shops on it in the order they are visited." />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {routes.data.map((r) => {
                const names = r.shopIds.map((id) => shopName.get(id) ?? "…");
                return (
                  <li key={r.id}>
                    <Card dense className="flex flex-wrap items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-title tracking-normal">
                          <Link href={`/app/manager/routes/${r.id}`} className="text-link">
                            {r.name}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-ink-2">
                          {r.shopIds.length === 0 ? "No shops yet" : `${r.shopIds.length} shop${r.shopIds.length === 1 ? "" : "s"}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`}
                        </p>
                      </div>
                      <Link href={`/app/manager/routes/${r.id}`} className={buttonClass("secondary", "sm")}>
                        Edit route
                      </Link>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          {unrouted > 0 ? (
            <p className="mt-4 text-sm text-ink-2">
              {unrouted} active shop{unrouted === 1 ? " is" : "s are"} on no route.{" "}
              <Link href="/app/manager/shops?route=none" className="text-link">
                See {unrouted === 1 ? "it" : "them"}
              </Link>
            </p>
          ) : null}
        </section>
        <AddRoute />
      </div>
    </>
  );
}

function AddRoute() {
  const router = useRouter();
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: "" } });
  const create = useApiMutation((api, name: string) => api.routes.create({ name }), [["routes"]]);
  const onSubmit = handleSubmit(async ({ name }) => {
    setProblem(null);
    try {
      const route = await create.mutateAsync(name);
      toast(`${route.name} added. Now put its shops in order.`);
      router.push(`/app/manager/routes/${route.id}`);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  });
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Add a route</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4">
        <Input label="Name" autoComplete="off" hint="Where it starts and ends, like Bagar to Lamachaur." error={formState.errors.name?.message} {...register("name")} />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Adding…">
          Add route
        </Button>
        <FormProblem message={problem} />
      </form>
    </Card>
  );
}
