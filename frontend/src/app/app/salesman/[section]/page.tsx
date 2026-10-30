import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingNext } from "@/components/app/ComingNext";
import { salesmanNav, sectionsOf } from "@/components/app/nav";

const BASE = "/app/salesman";
const label = (section: string) => salesmanNav.find((n) => n.href === `${BASE}/${section}`)?.label;

export function generateStaticParams() {
  return sectionsOf(salesmanNav, BASE).map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/app/salesman/[section]">): Promise<Metadata> {
  return { title: label((await params).section) ?? "Not found" };
}

async function Section({ params }: { params: PageProps<"/app/salesman/[section]">["params"] }) {
  const { section } = await params;
  const title = label(section);
  if (!title) notFound();
  return <ComingNext title={title} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function SalesmanSection({ params }: PageProps<"/app/salesman/[section]">) {
  return (
    <Suspense fallback={null}>
      <Section params={params} />
    </Suspense>
  );
}
