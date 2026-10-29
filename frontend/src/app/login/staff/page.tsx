import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm, LoginFormFromQuery } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Staff sign in" };

export default function StaffLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginForm kind="staff" />}>
        <LoginFormFromQuery kind="staff" />
      </Suspense>
    </AuthShell>
  );
}
