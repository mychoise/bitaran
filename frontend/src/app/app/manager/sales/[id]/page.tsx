import type { Metadata } from "next";
import { Suspense } from "react";
import { SaleDetail } from "@/components/app/records/Sales";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Sale" };

async function One({ params }: { params: PageProps<"/app/manager/sales/[id]">["params"] }) {
  const { id } = await params;
  return <SaleDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/sales/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
