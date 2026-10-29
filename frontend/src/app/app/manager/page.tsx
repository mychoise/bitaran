import type { Metadata } from "next";
import { AreaPage } from "@/components/auth/AreaPage";

export const metadata: Metadata = { title: "Manager" };

/** Owners and managers land here. */
export default function ManagerPage() {
  return <AreaPage path="/app/manager" />;
}
