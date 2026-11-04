import type { Metadata } from "next";
import { Today } from "@/components/app/salesman/Today";

export const metadata: Metadata = { title: "Today" };

/** Salesmen land here. */
export default function SalesmanPage() {
  return <Today />;
}
