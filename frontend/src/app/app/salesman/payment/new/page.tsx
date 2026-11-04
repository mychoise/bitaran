import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPayment } from "@/components/app/salesman/NewPayment";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Collect payment" };

// Reads the address (the visit, or the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <NewPayment />
    </Suspense>
  );
}
