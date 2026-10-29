import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "./session";
import { AuthError, type AuthErrorCode } from "./types";

const STATUS: Record<AuthErrorCode, number> = {
  invalid_credentials: 401,
  unauthorized: 401,
  rate_limited: 429,
  account_inactive: 403,
  unreachable: 503,
  invalid_input: 400,
};

/** JSON with Cache-Control: no-store, as every auth response must be. */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** A failure the screens can explain: only the code, never details. */
export function fail(code: AuthErrorCode): NextResponse {
  return json({ ok: false, error: code }, STATUS[code]);
}

/**
 * Turns anything thrown into a safe code. Only known AuthErrors pass through; anything
 * else (a stub, a misconfiguration, a network failure) becomes "unreachable", and is
 * logged without the request body, so no password or token reaches the logs.
 */
export function toCode(err: unknown): AuthErrorCode {
  if (err instanceof AuthError) return err.code;
  console.error("auth: request failed:", err instanceof Error ? err.message : "unknown error");
  return "unreachable";
}

/** Rejects cross-site posts: the Origin header must name this same host. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function setSession(res: NextResponse, value: string) {
  res.cookies.set(SESSION_COOKIE, value, sessionCookieOptions);
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads { email, password } from a JSON body, or null when it is not usable. */
export async function readCredentials(req: NextRequest): Promise<{ email: string; password: string } | null> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") return null;
    const { email, password } = body as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string") return null;
    const e = email.trim();
    if (!EMAIL.test(e) || e.length > 254 || password.length === 0 || password.length > 200) return null;
    return { email: e, password };
  } catch {
    return null;
  }
}
