import type { Metadata } from "next";
import { NewProduct } from "@/components/app/products/NewProduct";

export const metadata: Metadata = { title: "Add product" };

export default function NewProductPage() {
  return <NewProduct />;
}
