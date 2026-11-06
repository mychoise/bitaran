import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetail } from "@/components/app/records/Orders";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Order" };

async function One({ params }: { params: PageProps<"/app/manager/orders/[id]">["params"] }) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/orders/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
