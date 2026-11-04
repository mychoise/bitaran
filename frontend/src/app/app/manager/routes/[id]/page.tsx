import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteEditor } from "@/components/app/routes/RouteEditor";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Route" };

async function RoutePage({ params }: { params: PageProps<"/app/manager/routes/[id]">["params"] }) {
  const { id } = await params;
  return <RouteEditor id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/routes/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this route" />}>
      <RoutePage params={params} />
    </Suspense>
  );
}
