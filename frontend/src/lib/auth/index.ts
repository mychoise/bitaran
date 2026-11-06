import "server-only";
import { authMode } from "./env";
import { httpAuthClient } from "./http";
import type { AuthClient } from "./types";

/**
 * The one place that picks the implementation. Route handlers and server code call this,
 * never mock.ts or http.ts directly. Throws in production when AUTH_MODE is mock.
 * The mock (and its test accounts) is loaded only outside production, so a production build
 * never contains it.
 */
export async function getAuthClient(): Promise<AuthClient> {
  if (authMode() === "api") return httpAuthClient;
  if (process.env.NODE_ENV !== "production") return (await import("./mock")).mockAuthClient;
  throw new Error("AUTH_MODE=mock is not allowed in a production build.");
}
