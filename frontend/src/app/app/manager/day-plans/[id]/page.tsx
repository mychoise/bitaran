import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanDetail } from "@/components/app/dayplans/PlanDetail";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Day plan" };

async function Plan({ params }: { params: PageProps<"/app/manager/day-plans/[id]">["params"] }) {
  const { id } = await params;
  return <PlanDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/day-plans/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this day plan" />}>
      <Plan params={params} />
    </Suspense>
  );
}
