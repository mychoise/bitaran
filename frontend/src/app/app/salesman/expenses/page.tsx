import type { Metadata } from "next";
import { Expenses } from "@/components/app/salesman/Expenses";

export const metadata: Metadata = { title: "My expenses" };

export default function Page() {
  return <Expenses />;
}
