import type { Metadata } from "next";
import { AreaPage } from "@/components/auth/AreaPage";

export const metadata: Metadata = { title: "Shop" };

/** Shops land here. */
export default function ShopPage() {
  return <AreaPage path="/app/shop" />;
}
