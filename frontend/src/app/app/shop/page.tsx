import type { Metadata } from "next";
import { ShopOverview } from "@/components/app/Homes";

export const metadata: Metadata = { title: "Overview" };

/** Shops land here. */
export default function ShopPage() {
  return <ShopOverview />;
}
