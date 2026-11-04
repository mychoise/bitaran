import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopDetail } from "@/components/app/shops/ShopDetail";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Shop" };

async function Shop({ params }: { params: PageProps<"/app/manager/shops/[id]">["params"] }) {
  const { id } = await params;
  return <ShopDetail id={id} />;
}

// The URL segment and the open tab are read inside Suspense, as Cache Components requires.
export default function ShopPage({ params }: PageProps<"/app/manager/shops/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this shop" />}>
      <Shop params={params} />
    </Suspense>
  );
}
