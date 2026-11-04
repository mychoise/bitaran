import type { Metadata } from "next";
import { Suspense } from "react";
import { VisitPhoto } from "@/components/app/salesman/VisitPhoto";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Visit photo" };

// Reads the address (the visit, or the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <VisitPhoto />
    </Suspense>
  );
}
