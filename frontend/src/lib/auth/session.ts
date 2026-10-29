// The session cookie: a small signed value (HMAC-SHA256) holding the access token, a
// trimmed profile and an expiry. httpOnly, so page scripts never see it. Used by the
// route handlers, the proxy and server components; never by client code.

import { createHmac, timingSafeEqual } from "node:crypto";
import { isProduction, sessionSecret } from "./env";
import type { Profile } from "./types";

export const SESSION_COOKIE = "bitaran_session";
export const SESSION_MAX_AGE = 60 * 60 * 24; // one day, the same as the access token

export type Session = { v: 1; token: string; profile: Profile; exp: number };

export type SessionCheck =
  | { ok: true; session: Session }
  | { ok: false; reason: "missing" | "invalid" | "expired"; type?: Profile["type"] };

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const sign = (data: string) => createHmac("sha256", sessionSecret()).update(data).digest("base64url");

export function createSessionValue(token: string, profile: Profile): string {
  const session: Session = { v: 1, token, profile, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const data = b64(JSON.stringify(session));
  return `${data}.${sign(data)}`;
}

export function checkSession(value: string | undefined): SessionCheck {
  if (!value) return { ok: false, reason: "missing" };
  const [data, mac] = value.split(".");
  if (!data || !mac) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  let session: Session;
  try {
    session = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (session.v !== 1 || !session.token || !session.profile) return { ok: false, reason: "invalid" };
  if (session.exp <= Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired", type: session.profile.type };
  return { ok: true, session };
}

/** Cookie attributes. Secure only in production, so it also works on http://localhost. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
