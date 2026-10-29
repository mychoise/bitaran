import type { NextRequest } from "next/server";
import { clearSession, fail, isSameOrigin, json } from "@/lib/auth/route-utils";

/** Clears the session cookie. With a real backend, a server-side logout call would go here too. */
export function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return fail("invalid_input");
  const res = json({ ok: true });
  clearSession(res);
  return res;
}
