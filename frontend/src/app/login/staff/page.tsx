import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm, LoginFormFromQuery } from "@/components/auth/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return { title: t("staffSignIn") };
}

export default function StaffLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginForm kind="staff" />}>
        <LoginFormFromQuery kind="staff" />
      </Suspense>
    </AuthShell>
  );
}
