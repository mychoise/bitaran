import { config } from "@/config";

/** Organization structured data. Only facts we have are included; empty contact values are left out. */
export function OrganizationJsonLd() {
  const contactPoint = [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      areaServed: "NP",
      availableLanguage: ["en", "ne"],
      ...(config.salesEmail ? { email: config.salesEmail } : {}),
      ...(config.phone ? { telephone: config.phone } : {}),
    },
  ];
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.productName,
    url: config.siteUrl,
    description: "Software for wholesalers and distributors in Nepal: routes, udharo, payments with proof and end-of-day stock counts.",
    areaServed: { "@type": "Country", name: "Nepal" },
    ...(config.salesEmail || config.phone ? { contactPoint } : {}),
  };
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be emitted as raw JSON; the data is built from our own config only.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
