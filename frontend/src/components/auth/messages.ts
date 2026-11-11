import type { AuthErrorCode } from "@/lib/auth/types";

const KNOWN_CODES: AuthErrorCode[] = ["invalid_credentials", "rate_limited", "account_inactive", "unreachable", "unauthorized", "invalid_input"];
const known = new Set<string>(KNOWN_CODES);

/** A code from a response, or "unreachable" for anything unexpected. Pass the `Auth.messages` `t`. */
export function messageFor(code: unknown, t: (key: AuthErrorCode) => string): string {
  return t(typeof code === "string" && known.has(code) ? (code as AuthErrorCode) : "unreachable");
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
