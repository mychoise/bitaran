// Server-side auth settings, read from the environment (never NEXT_PUBLIC_).
// Both guards below refuse to run a production server with development settings.

export const isProduction = process.env.NODE_ENV === "production";

export type AuthMode = "mock" | "api";

/** AUTH_MODE: "mock" (default) or "api". Mock is refused in production. */
export function authMode(): AuthMode {
  const raw = (process.env.AUTH_MODE ?? "mock").trim().toLowerCase();
  if (raw !== "mock" && raw !== "api") throw new Error(`AUTH_MODE must be "mock" or "api", not "${raw}".`);
  if (raw === "mock" && isProduction) {
    throw new Error("AUTH_MODE=mock is not allowed in a production build. Set AUTH_MODE=api once the backend is connected.");
  }
  return raw;
}

/** Documented in .env.example. Fine for local development, rejected in production. */
export const DEV_SESSION_SECRET = "dev-only-session-secret-do-not-use-in-production";

/** SESSION_SECRET signs the session cookie. Production needs a real one, 32 characters or more. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (isProduction && (!secret || secret === DEV_SESSION_SECRET || secret.length < 32)) {
    throw new Error("SESSION_SECRET must be set to a random value of 32 characters or more in production.");
  }
  return secret || DEV_SESSION_SECRET;
}

/**
 * API_MODE: where the app's data comes from. "mock" (default) is the in-browser demo store;
 * "api" is the real backend. Never throws, so pages can read it while a build prerenders;
 * the production guard below is what refuses mock.
 */
export function readApiMode(): AuthMode {
  return (process.env.API_MODE ?? "mock").trim().toLowerCase() === "api" ? "api" : "mock";
}

function assertApiMode() {
  const raw = (process.env.API_MODE ?? "mock").trim().toLowerCase();
  if (raw !== "mock" && raw !== "api") throw new Error(`API_MODE must be "mock" or "api", not "${raw}".`);
  if (raw === "mock" && isProduction) {
    throw new Error("API_MODE=mock is not allowed in a production build. Set API_MODE=api once the backend is connected.");
  }
}

/** Fails fast at server start when the settings are unsafe for production. */
export function assertAuthConfig() {
  authMode();
  assertApiMode();
  sessionSecret();
}
