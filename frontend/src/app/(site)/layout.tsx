import { OrganizationJsonLd } from "@/components/site/OrganizationJsonLd";
import { RevealObserver } from "@/components/site/RevealObserver";
import { ScrollRoute } from "@/components/site/ScrollRoute";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";

// Every marketing page must render to static HTML at build time.
export const ensureStatic = "navigation";

/** The public website: smooth scrolling, nav, the scroll route, footer, WhatsApp button and structured data. The header and fixed things (the Pokhara route rail, the WhatsApp button) stay outside the smoothed content. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <SmoothScroll>
        <main id="main">{children}</main>
        <SiteFooter />
      </SmoothScroll>
      <ScrollRoute />
      <WhatsAppButton />
      <OrganizationJsonLd />
      <RevealObserver />
    </>
  );
}
