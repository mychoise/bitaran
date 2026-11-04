import type { Metadata } from "next";
import { RouteShops } from "@/components/app/salesman/RouteShops";

export const metadata: Metadata = { title: "Shops" };

export default function Page() {
  return <RouteShops />;
}
