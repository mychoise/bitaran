import { Suspense } from "react";
import { AppLoading, AppShell } from "./AppShell";
import { Welcome } from "./Welcome";
import { requireSession } from "@/lib/auth/server-session";

async function Content({ path }: { path: string }) {
  const session = await requireSession(path);
  return <Welcome profile={session.profile} />;
}

/** A placeholder landing page for one /app area. The real screens come next. */
export function AreaPage({ path }: { path: "/app/manager" | "/app/salesman" | "/app/shop" }) {
  return (
    <AppShell>
      <Suspense fallback={<AppLoading />}>
        <Content path={path} />
      </Suspense>
    </AppShell>
  );
}
