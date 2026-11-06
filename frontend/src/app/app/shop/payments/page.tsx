import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopPayments } from "@/components/app/shop/Portal";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Payments" };

// Reads the address (the dates), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <ShopPayments />
    </Suspense>
  );
}
