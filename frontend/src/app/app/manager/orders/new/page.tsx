import type { Metadata } from "next";
import { NewOrder } from "@/components/app/records/Orders";

export const metadata: Metadata = { title: "Take an order" };

export default function Page() {
  return <NewOrder />;
}
