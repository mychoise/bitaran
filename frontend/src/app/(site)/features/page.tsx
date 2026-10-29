import type { Metadata } from "next";
import Link from "next/link";
import { FeatureGroup } from "@/components/features/FeatureGroup";
import { groups } from "@/components/features/groups";
import { FinalCta } from "@/components/home/FinalCta";
import { pageMetadata } from "@/lib/metadata";

const description =
  "Every feature of Bitaran: routes and daily plans, the salesman's phone screen, visit photos, invoices, udharo, payments with proof, expenses, stock reconcile, returns, reports, roles and shop login.";

export const metadata: Metadata = pageMetadata("/features", "Features", description);

export default function FeaturesPage() {
  return (
    <>
      {/* Index hero: the page's contents are its visual. */}
      <section aria-labelledby="features-page-title" className="desk hero-screen flex items-center py-16">
        <div className="hero-text container">
          <h1 id="features-page-title" className="text-display">Every feature, and what it saves you</h1>
          <p className="lead mt-6 text-ink-2">
            Twelve features in four groups, each with who uses it.
          </p>
          <nav aria-label="Features on this page" className="mt-24">
            <ol className="m-0 grid list-none grid-cols-1 gap-x-columns gap-y-10 p-0 sm:grid-cols-2 xl:grid-cols-4">
              {groups.map((g, i) => (
                <li key={g.id} className="border-t-2 border-ink pt-4">
                  <Link href={`#${g.id}`} className="text-title font-semibold no-underline hover:underline">
                    {i + 1}. {g.name}
                  </Link>
                  <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                    {g.features.map((f) => (
                      <li key={f.id}>
                        <Link href={`#${f.id}`} className="footer-link">
                          {f.short}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>
      {groups.map((g, i) => (
        <FeatureGroup key={g.id} group={g} index={i} />
      ))}
      <FinalCta />
    </>
  );
}
