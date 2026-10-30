import type { Metadata } from "next";
import { ManagerToday } from "@/components/app/Homes";

export const metadata: Metadata = { title: "Today" };

/** Owners and managers land here. */
export default function ManagerPage() {
  return <ManagerToday />;
}
