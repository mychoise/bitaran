// Runs once when a Next.js server starts. In production it refuses to start with
// development auth settings (AUTH_MODE=mock, or a missing or default SESSION_SECRET):
// it prints why and exits, rather than running a server that fails every request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { assertAuthConfig } = await import("./lib/auth/env");
    try {
      assertAuthConfig();
    } catch (err) {
      console.error(`\nRefusing to start: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }
}
