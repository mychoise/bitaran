import type { Metadata } from "next";
import { CloseDay } from "@/components/app/salesman/CloseDay";

export const metadata: Metadata = { title: "Close day" };

export default function Page() {
  return <CloseDay />;
}
