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
    return {
      ready: Boolean(staff.data && routes.data && shops.data && products.data),
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
  }, [staff.data, routes.data, shops.data, products.data]);
}
