import type { Metadata } from "next";
import { TodaySales } from "@/components/app/salesman/TodaySales";

export const metadata: Metadata = { title: "Today's sales" };

export default function Page() {
  return <TodaySales />;
}
