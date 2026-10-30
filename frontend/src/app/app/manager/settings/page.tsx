import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BusinessSettings } from "@/components/app/settings/BusinessSettings";
import { LoadingState } from "@/components/ui/States";
import { requireSession } from "@/lib/auth/server-session";

export const metadata: Metadata = { title: "Settings" };

/** Settings are for the owner only: a manager who opens the address goes back to Today. */
async function OwnerOnly() {
  const { profile } = await requireSession("/app/manager");
  if (!(profile.type === "staff" && profile.role === "owner")) redirect("/app/manager");
  return <BusinessSettings />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading settings" />}>
      <OwnerOnly />
    </Suspense>
  );
}
