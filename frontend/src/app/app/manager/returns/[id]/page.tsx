import type { Metadata } from "next";
import { Suspense } from "react";
import { ReturnDetail } from "@/components/app/records/Returns";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Return" };

async function One({ params }: { params: PageProps<"/app/manager/returns/[id]">["params"] }) {
  const { id } = await params;
  return <ReturnDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/returns/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
