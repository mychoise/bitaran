import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AppLoading, AppShell } from "@/components/auth/AppShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { landingFor } from "@/lib/auth/areas";
import { requireSession } from "@/lib/auth/server-session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return { title: t("changePassword") };
}

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
