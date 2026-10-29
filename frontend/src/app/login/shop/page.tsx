import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm, LoginFormFromQuery } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Shop sign in" };

export default function ShopLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginForm kind="shop" />}>
        <LoginFormFromQuery kind="shop" />
      </Suspense>
    </AuthShell>
  );
}
