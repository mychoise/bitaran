import type { Metadata } from "next";
import { SalesmanToday } from "@/components/app/Homes";

export const metadata: Metadata = { title: "Today" };

/** Salesmen land here. */
export default function SalesmanPage() {
  return <SalesmanToday />;
}
