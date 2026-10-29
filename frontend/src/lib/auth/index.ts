import "server-only";
import { authMode } from "./env";
import { httpAuthClient } from "./http";
import { mockAuthClient } from "./mock";
import type { AuthClient } from "./types";

/**
 * The one place that picks the implementation. Route handlers and server code call this,
 * never mock.ts or http.ts directly. Throws in production when AUTH_MODE is mock.
 */
export function getAuthClient(): AuthClient {
  return authMode() === "api" ? httpAuthClient : mockAuthClient;
}
