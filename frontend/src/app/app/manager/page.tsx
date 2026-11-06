import type { Metadata } from "next";
import { ManagerDashboard } from "@/components/app/reports/Dashboard";

export const metadata: Metadata = { title: "Today" };

/** Owners and managers land here. */
export default function ManagerPage() {
  return <ManagerDashboard />;
}
