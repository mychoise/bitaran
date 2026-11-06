"use client";

// Names for the ids on a day plan: salesmen, routes, shops and products, loaded once and shared.

import { useMemo } from "react";
import { useApiQuery } from "@/lib/api/provider";
import type { Product, Route, ShopWithBalance, Staff } from "@/lib/api/types";

export function usePlanLookups() {
  const staff = useApiQuery(["staff", "list", {}], (api) => api.staff.list());
  const routes = useApiQuery(["routes", "list"], (api) => api.routes.list());
  const shops = useApiQuery(["shops", "list", "all"], (api) => api.shops.list({ pageSize: 200 }));
  const products = useApiQuery(["products", "list", "names"], (api) => api.products.list({ pageSize: 200 }));
  return useMemo(() => {
    const people = new Map<string, Staff>((staff.data ?? []).map((s) => [s.id, s]));
    const routeMap = new Map<string, Route>((routes.data ?? []).map((r) => [r.id, r]));
    const shopMap = new Map<string, ShopWithBalance>((shops.data?.items ?? []).map((s) => [s.id, s]));
    const productMap = new Map<string, Product>((products.data?.items ?? []).map((p) => [p.id, p]));
    const failed = [staff, routes, shops, products].find((q) => q.isError);
    return {
      ready: Boolean(staff.data && routes.data && shops.data && products.data),
      /** The first lookup that failed, if any. Screens that need the lists show it with Retry. */
      error: failed?.error ?? null,
      retry: () => [staff, routes, shops, products].filter((q) => q.isError).forEach((q) => q.refetch()),
      staff: staff.data ?? [],
      salesmen: (staff.data ?? []).filter((s) => s.role === "salesman"),
      routes: routes.data ?? [],
      shops: [...(shops.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
      products: products.data?.items ?? [],
      person: (id: string) => people.get(id)?.fullName ?? "…",
      route: (id: string) => routeMap.get(id),
      shop: (id: string) => shopMap.get(id),
      product: (id: string) => productMap.get(id),
    };
    // The query objects change every render; the data and errors are what matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.data, routes.data, shops.data, products.data, staff.error, routes.error, shops.error, products.error]);
}
