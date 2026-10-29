import "server-only";
import type { AuthClient } from "./types";

// STUB. The real backend is not connected yet.
// When it is, replace each method with a call to API_URL following docs/auth-contract.md,
// and map its failures to AuthError codes (401 -> invalid_credentials or unauthorized,
// 429 -> rate_limited, 403 -> account_inactive, network failure -> unreachable).
// Until then every call throws, which the route handlers report as "cannot reach the server".

const notConnected = (): never => {
  throw new Error("Backend not connected yet");
};

export const httpAuthClient: AuthClient = {
  staffLogin: async () => notConnected(),
  shopLogin: async () => notConnected(),
  me: async () => notConnected(),
  changePassword: async () => notConnected(),
};
