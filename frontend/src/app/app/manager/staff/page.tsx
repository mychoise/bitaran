import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffList } from "@/components/app/staff/StaffList";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Staff" };

// The filters are read from the address, which happens at request time: inside Suspense.
export default function StaffPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading staff" />}>
      <StaffList />
    </Suspense>
  );
}
