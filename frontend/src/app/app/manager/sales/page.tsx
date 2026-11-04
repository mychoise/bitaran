import type { Metadata } from "next";
import { Suspense } from "react";
import { SaleList } from "@/components/app/records/Sales";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Sales" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <SaleList />
    </Suspense>
  );
}
