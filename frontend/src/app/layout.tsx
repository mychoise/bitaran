import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { config } from "@/config";
import "./globals.css";

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
    <html lang="en" className={`${generalSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        {/* Marks that scripting runs, before first paint, so reveal styles never hide content when it does not. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
