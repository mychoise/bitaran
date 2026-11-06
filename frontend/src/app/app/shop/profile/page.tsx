import type { Metadata } from "next";
import { ShopProfile } from "@/components/app/shop/Portal";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <ShopProfile />;
}
