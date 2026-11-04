import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentList } from "@/components/app/records/Payments";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Payments" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <PaymentList />
    </Suspense>
  );
}
