import type { Metadata } from "next";
import { Suspense } from "react";
import { NewReturn } from "@/components/app/salesman/NewReturn";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Return goods" };

// Reads the address (the visit, or the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <NewReturn />
    </Suspense>
  );
}
