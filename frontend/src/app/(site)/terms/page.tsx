import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { config } from "@/config";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("/terms", "Terms", `Draft terms of use for the ${config.productName} website.`);

export default function TermsPage() {
  return (
    <LegalPage id="terms-title" title="Terms">
      <LegalSection title="This website">
        <p>This site describes {config.productName}. The screens shown on it use sample data.</p>
      </LegalSection>
      <LegalSection title="Using the software">
        <p>Use of {config.productName} itself is covered by the agreement you sign with us, not by this page.</p>
      </LegalSection>
      <LegalSection title="Prices">
        <p>Prices are given in a written quote. Nothing on this site is an offer.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>We may update these terms. The date of the latest version will be shown here.</p>
      </LegalSection>
    </LegalPage>
  );
}
