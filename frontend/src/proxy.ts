import { NextResponse, type NextRequest } from "next/server";
import { canOpen, landingFor, LOGIN_PATH } from "@/lib/auth/areas";
import { checkSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * Guards /app/*: no valid session goes to a login page, the wrong area goes to the person's
 * own area. Also sends someone already signed in from /login to their area.
 * A convenience for the screens only; the real backend stays the authority.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const check = checkSession(raw);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return check.ok ? to(landingFor(check.session.profile)) : NextResponse.next();
  }

  if (!check.ok) {
    // Never signed in: the chooser. A session that ended: the right login, with a short note.
    if (check.reason === "missing") return to("/login");
    const res = to(`${check.type ? LOGIN_PATH[check.type] : "/login"}?ended=1`);
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  const profile = check.session.profile;
  if (!canOpen(pathname, profile)) return to(landingFor(profile));

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/login/:path*"],
};
