import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffDetail } from "@/components/app/staff/StaffDetail";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Staff member" };

async function Person({ params }: { params: PageProps<"/app/manager/staff/[id]">["params"] }) {
  const { id } = await params;
  return <StaffDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function StaffMemberPage({ params }: PageProps<"/app/manager/staff/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading this person" />}>
      <Person params={params} />
    </Suspense>
  );
}
