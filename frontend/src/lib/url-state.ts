"use client";

// Filters and sort live in the address, so a filtered list can be shared, bookmarked or reloaded.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { SortState } from "@/components/ui/Table";

export function useUrlState<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const set = useCallback(
    (patch: Partial<Record<K, string>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [values, set] as const;
}

/** "name:asc" in the address ↔ the table's sort state. */
export const parseSort = (v: string): SortState => {
  const [key, dir] = v.split(":");
  return key && (dir === "asc" || dir === "desc") ? { key, dir } : null;
};
export const formatSort = (s: SortState) => (s ? `${s.key}:${s.dir}` : "");
