import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductList } from "@/components/app/products/ProductList";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Products and stock" };

// The filters are read from the address, which happens at request time: inside Suspense.
export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading products" />}>
      <ProductList />
    </Suspense>
  );
}
