import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseList } from "@/components/app/expenses/Expenses";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Expenses" };

// Reads the address (the filters), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <ExpenseList />
    </Suspense>
  );
}
