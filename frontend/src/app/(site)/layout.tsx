import { OrganizationJsonLd } from "@/components/site/OrganizationJsonLd";
import { RevealObserver } from "@/components/site/RevealObserver";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";

// Every marketing page must render to static HTML at build time.
export const ensureStatic = "navigation";

/** The public website: nav, footer, WhatsApp button and structured data. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <WhatsAppButton />
      <OrganizationJsonLd />
      <RevealObserver />
    </>
  );
}
