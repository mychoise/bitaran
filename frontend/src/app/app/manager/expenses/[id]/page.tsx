import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseDetail } from "@/components/app/expenses/Expenses";
import { LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Expense" };

async function One({ params }: { params: PageProps<"/app/manager/expenses/[id]">["params"] }) {
  const { id } = await params;
  return <ExpenseDetail id={id} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function Page({ params }: PageProps<"/app/manager/expenses/[id]">) {
  return (
    <Suspense fallback={<LoadingState label="Loading" />}>
      <One params={params} />
    </Suspense>
  );
}
