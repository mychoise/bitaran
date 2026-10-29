import type { Metadata } from "next";
import { Suspense } from "react";
import { AppLoading, AppShell } from "@/components/auth/AppShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { landingFor } from "@/lib/auth/areas";
import { requireSession } from "@/lib/auth/server-session";

export const metadata: Metadata = { title: "Change password" };

async function Content() {
  const session = await requireSession("/app/change-password");
  return <ChangePasswordForm backHref={landingFor(session.profile)} />;
}

export default function ChangePasswordPage() {
  return (
    <AppShell>
      <Suspense fallback={<AppLoading />}>
        <Content />
      </Suspense>
    </AppShell>
  );
}
