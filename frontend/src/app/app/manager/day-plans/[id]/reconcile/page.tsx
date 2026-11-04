import type { Metadata } from "next";
import { Suspense } from "react";
import { ReconcilePage } from "@/components/app/dayplans/Reconcile";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Reconcile" };

async function Plan({ params }: { params: PageProps<"/app/manager/day-plans/[id]/reconcile">["params"] }) {
  const { id } = await params;
  return <ReconcilePage id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/day-plans/[id]/reconcile">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this day plan" />}>
      <Plan params={params} />
    </Suspense>
  );
}
