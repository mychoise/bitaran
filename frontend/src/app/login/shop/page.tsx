import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm, LoginFormFromQuery } from "@/components/auth/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return { title: t("shopSignIn") };
}

export default function ShopLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginForm kind="shop" />}>
        <LoginFormFromQuery kind="shop" />
      </Suspense>
    </AuthShell>
  );
}
