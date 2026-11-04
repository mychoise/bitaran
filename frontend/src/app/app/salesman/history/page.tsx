import type { Metadata } from "next";
import { Suspense } from "react";
import { History } from "@/components/app/salesman/History";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "My sales" };

// Reads the address (the visit, or the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <History />
    </Suspense>
  );
}
