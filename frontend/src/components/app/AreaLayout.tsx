import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Overlay";
import { LoadingState } from "@/components/ui/States";
import { ApiProvider } from "@/lib/api/provider";
import type { Viewer } from "@/lib/api/types";
import { readApiMode } from "@/lib/auth/env";
import { requireSession } from "@/lib/auth/server-session";
import type { Profile } from "@/lib/auth/types";
import { ManagerShell, SalesmanShell, ShopShell } from "./Shells";

type Area = "/app/manager" | "/app/salesman" | "/app/shop";

const toViewer = (p: Profile): Viewer =>
  p.type === "staff" ? { id: p.id, type: "staff", role: p.role, name: p.fullName } : { id: p.id, type: "shop", name: p.name };

async function Loaded({ area, children }: { area: Area; children: ReactNode }) {
  const session = await requireSession(area);
  const Shell = area === "/app/manager" ? ManagerShell : area === "/app/salesman" ? SalesmanShell : ShopShell;
  return (
    <ApiProvider mode={readApiMode()} viewer={toViewer(session.profile)}>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </ApiProvider>
  );
}

/**
 * The signed-in frame for one area. The session is read on the server (inside Suspense, so the
 * route can still prerender its shell); the person and the API mode go to the client shell.
 */
export function AreaLayout({ area, children }: { area: Area; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16">
          <LoadingState label="Loading your area" />
        </div>
      }
    >
      <Loaded area={area}>{children}</Loaded>
    </Suspense>
  );
}
