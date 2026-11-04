import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnList } from "@/components/app/records/Returns";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Returns" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <ReturnList />
    </Suspense>
  );
}
