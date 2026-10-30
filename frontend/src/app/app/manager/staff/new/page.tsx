import type { Metadata } from "next";
import { NewStaff } from "@/components/app/staff/NewStaff";

export const metadata: Metadata = { title: "Add staff" };

export default function NewStaffPage() {
  return <NewStaff />;
}
