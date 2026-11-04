import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentDetail } from "@/components/app/records/Payments";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Payment" };

async function One({ params }: { params: PageProps<"/app/manager/payments/[id]">["params"] }) {
  const { id } = await params;
  return <PaymentDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/payments/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
