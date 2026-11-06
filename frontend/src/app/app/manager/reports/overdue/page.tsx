import type { Metadata } from "next";
import { Suspense } from "react";
import { OverdueReport } from "@/components/app/reports/Reports";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Overdue credit" };

// Reads the address (the dates), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <OverdueReport />
    </Suspense>
  );
}
