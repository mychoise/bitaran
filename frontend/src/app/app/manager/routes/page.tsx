import type { Metadata } from "next";
import { RouteList } from "@/components/app/routes/RouteList";

export const metadata: Metadata = { title: "Routes" };

export default function RoutesPage() {
  return <RouteList />;
}
