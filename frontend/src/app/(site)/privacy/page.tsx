import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { config } from "@/config";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata("/privacy", "Privacy", `Draft privacy notice for the ${config.productName} website.`);

export default function PrivacyPage() {
  return (
    <LegalPage id="privacy-title" title="Privacy">
      <LegalSection title="What this website collects">
        <p>No cookies, no tracking, no analytics.</p>
        <p>The contact form sends us only what you type into it.</p>
      </LegalSection>
      <LegalSection title="How we use it">
        <p>Only to reply to you. We do not sell it or share it.</p>
      </LegalSection>
      <LegalSection title="The software itself">
        <p>Data in {config.productName} is covered by your agreement with us.</p>
      </LegalSection>
      <LegalSection title="Questions">
        <p>Ask us, and we will show you what we hold about you or delete it.</p>
      </LegalSection>
    </LegalPage>
  );
}
