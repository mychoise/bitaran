import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetail } from "@/components/app/products/ProductDetail";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Product" };

async function Product({ params }: { params: PageProps<"/app/manager/products/[id]">["params"] }) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function ProductPage({ params }: PageProps<"/app/manager/products/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this product" />}>
      <Product params={params} />
    </Suspense>
  );
}
