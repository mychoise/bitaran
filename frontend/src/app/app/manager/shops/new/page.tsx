import type { Metadata } from "next";
import { NewShop } from "@/components/app/shops/NewShop";

export const metadata: Metadata = { title: "Add shop" };

export default function NewShopPage() {
  return <NewShop />;
}
