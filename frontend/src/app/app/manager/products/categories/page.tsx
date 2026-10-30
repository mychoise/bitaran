import type { Metadata } from "next";
import { CategoryList } from "@/components/app/products/CategoryList";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return <CategoryList />;
}
