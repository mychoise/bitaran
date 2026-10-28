import Link from "next/link";
import { config } from "@/config";
import { legalNav } from "@/lib/nav";
import { NeedsConfirmation, Placeholder } from "@/components/ui/Placeholder";

const productLinks = [
  { href: "/features#routes", label: "Routes and daily plans" },
  { href: "/features#credit", label: "Udharo and balances" },
  { href: "/features#payments", label: "Payments with proof" },
  { href: "/features#reconcile", label: "End-of-day reconcile" },
  { href: "/features#reports", label: "Reports" },
];

const companyLinks = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

/** Photographs from Wikimedia Commons used anywhere on the site. Each needs its credit. */
const photoCredits = [
  {
    href: "https://commons.wikimedia.org/wiki/File:VitorJubini_MercadoDaVilaRubim_Vitoria_ES_(39182859020)_(square_crop).jpg",
    label: "Chillies at Mercado da Vila Rubim by MTur Destinos (public domain, Wikimedia Commons)",
  },
  {
    href: "https://commons.wikimedia.org/wiki/File:Stacked_up_maize_sacks.jpg",
    label: "Stacked up maize sacks by Cut angles (CC BY-SA 4.0, Wikimedia Commons)",
  },
];

function LinkList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-md font-semibold tracking-normal">{title}</h2>
      <ul className="mt-3 flex list-none flex-col gap-2 p-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="footer-link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The statement footer: one closing sentence set large, the links beneath. */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-paper-2 pt-section-s pb-12">
      <div className="container">
        <p className="footer-statement max-w-4xl">
          {config.productName} keeps the route, the udharo and the evening count in one place.
        </p>
        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <LinkList title="Product" links={productLinks} />
          <LinkList title="Company" links={companyLinks} />
          <div>
            <h2 className="text-md font-semibold tracking-normal">Talk to us</h2>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0">
              <li>
                {config.salesEmail ? (
                  <a href={`mailto:${config.salesEmail}`} className="footer-link">{config.salesEmail}</a>
                ) : (
                  <Placeholder label="sales email" />
                )}
              </li>
              <li>
                {config.phone ? (
                  <a href={`tel:${config.phone.replace(/\s/g, "")}`} className="footer-link">{config.phone}</a>
                ) : (
                  <Placeholder label="phone / WhatsApp" />
                )}
              </li>
              <li className="text-ink-2">
                <NeedsConfirmation>Serving wholesalers across Nepal</NeedsConfirmation>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-md font-semibold tracking-normal">Already using it</h2>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0">
              <li>
                <a href={config.appUrl} className="footer-link">Login</a>
              </li>
              {legalNav.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="footer-link">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-rule-2 pt-6 text-sm text-ink-2">
          <p data-credits>
            Photographs:{" "}
            {photoCredits.map((c, i) => (
              <span key={c.href}>
                {i > 0 ? ", " : null}
                <a href={c.href} className="footer-link">{c.label}</a>
              </span>
            ))}
            .
          </p>
          <p>
            © {config.copyrightYear} {config.productName}. Software for wholesalers and distributors in Nepal.
          </p>
        </div>
      </div>
    </footer>
  );
}
