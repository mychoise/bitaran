import type { Metadata } from "next";
import { AreaPage } from "@/components/auth/AreaPage";

export const metadata: Metadata = { title: "Salesman" };

/** Salesmen land here. */
export default function SalesmanPage() {
  return <AreaPage path="/app/salesman" />;
}
