import type { Metadata } from "next";
import { config } from "@/config";

/** Per-page title, description, canonical URL and a complete Open Graph block. */
export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: config.productName,
      locale: "en_NP",
      title: `${title} | ${config.productName}`,
      description,
      url: path,
    },
  };
}
