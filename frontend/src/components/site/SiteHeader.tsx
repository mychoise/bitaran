import Link from "next/link";
import { config } from "@/config";
import { mainNav } from "@/lib/nav";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

/** The slab: one heavy full-width bar, sticky, with the wordmark, the pages, Login and the main button. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper-2">
      <div className="container relative flex h-18 items-center justify-between gap-6">
        <Link href="/" aria-label={`${config.productName}, home`} className="wordmark no-underline">
          {config.productName}
        </Link>
        <nav aria-label="Main" className="hidden xl:block">
          <NavLinks items={mainNav} />
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          <a href={config.appUrl} className="nav-link">
            Login
          </a>
          <ButtonLink href={config.demoUrl}>Request a demo</ButtonLink>
        </div>
        <MobileMenu items={mainNav} appUrl={config.appUrl} demoUrl={config.demoUrl} />
      </div>
    </header>
  );
}
