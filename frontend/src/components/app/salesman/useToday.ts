"use client";

// Today's plan for the signed-in salesman, with its report (stock, cash, sales) once there is one.

import { useApiQuery } from "@/lib/api/provider";

export function useToday() {
  const plan = useApiQuery(["dayPlans", "today"], (api) => api.dayPlans.today());
  const id = plan.data?.id;
  const report = useApiQuery(["dayPlans", "report", id ?? "none"], (api) => api.dayPlans.report(id!), { enabled: Boolean(id) });
  return { plan, report };
}

/** Every change on the day refreshes the plan, its report, its shops and the balances. */
export const DAY_AFFECTS = [["dayPlans"], ["visits"], ["shops"], ["sales"], ["payments"]];
