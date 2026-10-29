import type { AuthErrorCode } from "@/lib/auth/types";

/** The only words a person ever sees for an auth failure. Never a code, never details. */
export const authMessages: Record<AuthErrorCode, string> = {
  invalid_credentials: "That email or password is not right.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  account_inactive: "This account is switched off. Please contact your business owner.",
  unreachable: "We could not reach the server. Please try again.",
  unauthorized: "Your session ended. Please sign in again.",
  invalid_input: "Please check the email and password and try again.",
};

const known = new Set(Object.keys(authMessages));

/** A code from a response, or "unreachable" for anything unexpected. */
export function messageFor(code: unknown): string {
  return typeof code === "string" && known.has(code) ? authMessages[code as AuthErrorCode] : authMessages.unreachable;
}

export const SESSION_ENDED = authMessages.unauthorized;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
