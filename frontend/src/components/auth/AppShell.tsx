import type { ReactNode } from "react";
import { AuthTopBar } from "./AuthShell";

/** The signed-in area's frame: the same top bar as login, then the page on the desk. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AuthTopBar />
      <main id="main" className="desk flex flex-1 items-center py-16">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}

/** A quiet placeholder while the session is read on the server. */
export function AppLoading() {
  return (
    <p role="status" className="text-lg text-muted">
      Loading…
    </p>
  );
}
