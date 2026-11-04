import type { Metadata } from "next";
import { Suspense } from "react";
import { PhotoReview } from "@/components/app/records/Photos";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Visit photos" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <PhotoReview />
    </Suspense>
  );
}
