import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseSummaryView } from "@/components/app/expenses/Expenses";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Expense summary" };

// Reads the address (the date range), which happens at request time: inside Suspense.
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <ExpenseSummaryView />
    </Suspense>
  );
}
