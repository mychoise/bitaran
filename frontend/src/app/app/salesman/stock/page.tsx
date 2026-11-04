import type { Metadata } from "next";
import { StockToday } from "@/components/app/salesman/StockToday";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return <StockToday />;
}
