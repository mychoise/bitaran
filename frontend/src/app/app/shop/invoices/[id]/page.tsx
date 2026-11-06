import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopInvoiceDetail } from "@/components/app/shop/Portal";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Invoice" };

async function One({ params }: { params: PageProps<"/app/shop/invoices/[id]">["params"] }) {
  const { id } = await params;
  return <ShopInvoiceDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/shop/invoices/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
