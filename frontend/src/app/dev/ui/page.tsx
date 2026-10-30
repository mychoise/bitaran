import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StyleGuide } from "@/components/dev/StyleGuide";

export const metadata: Metadata = { title: "App kit (dev)", robots: { index: false, follow: false } };

/** Development only: a production build answers 404 here. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <StyleGuide />
    </Suspense>
  );
}
