import type { Metadata } from "next";
import { Suspense } from "react";
import { NewSale } from "@/components/app/salesman/NewSale";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "New sale" };

// Reads the address (the visit, or the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <NewSale />
    </Suspense>
  );
}
