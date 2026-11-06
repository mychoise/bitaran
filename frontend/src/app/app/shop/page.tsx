import type { Metadata } from "next";
import { ShopHome } from "@/components/app/shop/Portal";

export const metadata: Metadata = { title: "Home" };

/** Shops land here. */
export default function ShopPage() {
  return <ShopHome />;
}
