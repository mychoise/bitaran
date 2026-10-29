import "server-only";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canOpen, landingFor } from "./areas";
import { checkSession, SESSION_COOKIE, type Session } from "./session";

/**
 * For /app pages: the current session, or a redirect. The proxy already does this; checking
 * again here keeps each page safe on its own. Must be called inside a <Suspense> boundary.
 */
export async function requireSession(pathname: string): Promise<Session> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  await io(); // the expiry check reads the clock: a per-request value, never prerendered
  const check = checkSession(value);
  if (!check.ok) redirect("/login");
  if (!canOpen(pathname, check.session.profile)) redirect(landingFor(check.session.profile));
  return check.session;
}
