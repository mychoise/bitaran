import { NextResponse, type NextRequest } from "next/server";
import { apiUrl, readApiMode } from "@/lib/auth/env";
import { clearSession, isSameOrigin } from "@/lib/auth/route-utils";
import { checkSession, SESSION_COOKIE } from "@/lib/auth/session";

// The browser's way to the backend. The access token lives in the httpOnly session cookie, so
// the page cannot send it itself: this route reads the cookie, adds `Authorization: Bearer`,
// and passes the request and the answer through unchanged. Only in API_MODE=api.

/** Request headers worth passing on. Cookies and the browser's own auth never leave this server. */
const FORWARD = ["content-type", "idempotency-key", "accept"];
/** Response headers worth passing back. */
const BACK = ["content-type", "content-length", "cache-control", "etag", "last-modified", "idempotent-replayed"];

async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (readApiMode() !== "api") return NextResponse.json({ error: { code: "NOT_CONNECTED", message: "API_MODE is not api" } }, { status: 503 });
  if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cross-site request" } }, { status: 403 });
  }
  const check = checkSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!check.ok) {
    const res = NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Session ended" } }, { status: 401 });
    clearSession(res);
    return res;
  }

  const { path } = await params;
  const target = `${apiUrl()}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const headers = new Headers({ Authorization: `Bearer ${check.session.token}` });
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: { code: "UNREACHABLE", message: "The backend could not be reached" } }, { status: 502 });
  }

  const out = new Headers();
  for (const h of BACK) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  const res = new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
  // The backend no longer accepts the token: end the session here too.
  if (upstream.status === 401) clearSession(res);
  return res;
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
