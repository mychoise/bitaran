import type { Metadata } from "next";
import { ReportsHub } from "@/components/app/reports/Reports";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsHub />;
}
