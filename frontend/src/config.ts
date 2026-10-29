// Every value that changes between environments lives here.
// Each one reads a NEXT_PUBLIC_ variable (see .env.example) and falls back to a safe default.

const read = (value: string | undefined, fallback: string) =>
  value && value.trim() !== "" ? value.trim() : fallback;

export const config = {
  productName: "Bitaran",
  /** Public address of this marketing site, used for canonical URLs, Open Graph and the sitemap. */
  siteUrl: read(process.env.NEXT_PUBLIC_SITE_URL, "https://bitaran.example.com").replace(/\/$/, ""),
  /** Where the Login button goes: this site's login chooser by default. */
  appUrl: read(process.env.NEXT_PUBLIC_APP_URL, "/login"),
  /** Where "Request a demo" goes. Defaults to this site's contact page. */
  demoUrl: read(process.env.NEXT_PUBLIC_DEMO_URL, "/contact"),
  /** Form endpoint. Empty means the contact form falls back to email and WhatsApp. */
  contactEndpoint: read(process.env.NEXT_PUBLIC_CONTACT_ENDPOINT, ""),
  /** Empty values show as [PLACEHOLDER] on the page until they are set. */
  salesEmail: read(process.env.NEXT_PUBLIC_SALES_EMAIL, ""),
  supportEmail: read(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, ""),
  /** Phone and WhatsApp numbers with country code, e.g. +977 98XXXXXXXX. */
  phone: read(process.env.NEXT_PUBLIC_PHONE, ""),
  whatsapp: read(process.env.NEXT_PUBLIC_WHATSAPP, ""),
  /** Fixed rather than computed, so every page stays fully static. */
  copyrightYear: read(process.env.NEXT_PUBLIC_COPYRIGHT_YEAR, "2026"),
} as const;

/** wa.me link for the configured WhatsApp number, or null when none is set. */
export function whatsappHref(text?: string): string | null {
  const digits = config.whatsapp.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const isExternal = (href: string) => /^https?:\/\//.test(href);
