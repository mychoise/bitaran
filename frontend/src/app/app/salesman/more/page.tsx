import type { Metadata } from "next";
import { More } from "@/components/app/salesman/More";

export const metadata: Metadata = { title: "More" };

export default function Page() {
  return <More />;
}
