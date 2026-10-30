import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ComingNext } from "@/components/app/ComingNext";
import { managerNav, sectionsOf } from "@/components/app/nav";

const BASE = "/app/manager";
const label = (section: string) => managerNav.find((n) => !n.built && n.href === `${BASE}/${section}`)?.label;

export function generateStaticParams() {
  return sectionsOf(managerNav, BASE).map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/app/manager/[section]">): Promise<Metadata> {
  return { title: label((await params).section) ?? "Not found" };
}

async function Section({ params }: { params: PageProps<"/app/manager/[section]">["params"] }) {
  const { section } = await params;
  const title = label(section);
  if (!title) notFound();
  return <ComingNext title={title} />;
}

// The URL segment is read inside Suspense, as Cache Components requires.
export default function ManagerSection({ params }: PageProps<"/app/manager/[section]">) {
  return (
    <Suspense fallback={null}>
      <Section params={params} />
    </Suspense>
  );
}
