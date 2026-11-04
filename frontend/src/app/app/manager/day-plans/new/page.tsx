import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { NewPlan } from "@/components/app/dayplans/NewPlan";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "New day plan" };

/** The form starts from today's date, a per-request value: never prerendered. */
async function Form() {
  await io();
  return <NewPlan />;
}

export default function NewDayPlanPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <Form />
    </Suspense>
  );
}
