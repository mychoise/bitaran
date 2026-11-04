import type { Metadata } from "next";
import { NewShop } from "@/components/app/salesman/NewShop";

export const metadata: Metadata = { title: "New shop" };

export default function Page() {
  return <NewShop />;
}
