import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { config } from "@/config";
import { OrganizationJsonLd } from "@/components/site/OrganizationJsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";
import "./globals.css";

// Every route must render to static HTML at build time.
export const ensureStatic = "navigation";

const generalSans = localFont({
  variable: "--font-general-sans",
  display: "swap",
  src: [
    { path: "../fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeneralSans-Semibold.woff2", weight: "600", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Software for wholesalers and distributors in Nepal. Plan routes, record sales and udharo at the shop, check cheques and visits, and count stock every evening.";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: `${config.productName}: route sales software for Nepali wholesalers`,
    template: `%s | ${config.productName}`,
  },
  description,
  applicationName: config.productName,
  openGraph: {
    type: "website",
    siteName: config.productName,
    locale: "en_NP",
    title: `${config.productName}: route sales software for Nepali wholesalers`,
    description,
    url: "/",
  },
  twitter: { card: "summary" },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${generalSans.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <WhatsAppButton />
        <OrganizationJsonLd />
      </body>
    </html>
  );
}
