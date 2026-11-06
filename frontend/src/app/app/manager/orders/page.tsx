import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderList } from "@/components/app/records/Orders";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Orders" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <OrderList />
    </Suspense>
  );
}
