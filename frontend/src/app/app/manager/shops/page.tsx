import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopList } from "@/components/app/shops/ShopList";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Shops" };

// The filters are read from the address, which happens at request time: inside Suspense.
export default function ShopsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading shops" />}>
      <ShopList />
    </Suspense>
  );
}
