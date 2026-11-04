import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanList } from "@/components/app/dayplans/PlanList";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Day plans" };

// The filters are read from the address, which happens at request time: inside Suspense.
export default function DayPlansPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading day plans" />}>
      <PlanList />
    </Suspense>
  );
}
