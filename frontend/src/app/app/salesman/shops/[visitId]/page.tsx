import type { Metadata } from "next";
import { Suspense } from "react";
import { VisitScreen } from "@/components/app/salesman/VisitScreen";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Shop" };

async function Visit({ params }: { params: PageProps<"/app/salesman/shops/[visitId]">["params"] }) {
  const { visitId } = await params;
  return <VisitScreen visitId={visitId} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/salesman/shops/[visitId]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this shop" />}>
      <Visit params={params} />
    </Suspense>
  );
}
