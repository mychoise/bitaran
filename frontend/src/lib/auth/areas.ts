// Which /app area each person may open. Used by the proxy and the pages.
// A convenience for the screens only: the real backend stays the authority.

import type { Profile } from "./types";

export const LOGIN_PATH = { staff: "/login/staff", shop: "/login/shop" } as const;

/** Where a person lands after login. */
export function landingFor(p: Profile): string {
  if (p.type === "shop") return "/app/shop";
  return p.role === "salesman" ? "/app/salesman" : "/app/manager";
}

/** Whether this person may open this /app path. */
export function canOpen(pathname: string, p: Profile): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/app/change-password") return true;
  if (path.startsWith("/app/manager")) return p.type === "staff" && (p.role === "owner" || p.role === "manager");
  if (path.startsWith("/app/salesman")) return p.type === "staff" && p.role === "salesman";
  if (path.startsWith("/app/shop")) return p.type === "shop";
  return false;
}
