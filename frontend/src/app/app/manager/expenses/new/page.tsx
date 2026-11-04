import type { Metadata } from "next";
import { NewExpense } from "@/components/app/expenses/Expenses";

export const metadata: Metadata = { title: "New expense" };

export default function Page() {
  return <NewExpense />;
}
