import type { Metadata } from "next";
import { Suspense } from "react";
import { LowStockReport } from "@/components/app/reports/Reports";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Low stock" };

// Reads the address (the dates), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <LowStockReport />
    </Suspense>
  );
}
