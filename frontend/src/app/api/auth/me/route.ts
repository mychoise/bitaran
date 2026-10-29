import type { NextRequest } from "next/server";
import { getAuthClient } from "@/lib/auth";
import { clearSession, fail, json, toCode } from "@/lib/auth/route-utils";
import { checkSession, SESSION_COOKIE } from "@/lib/auth/session";

/** The logged-in person's safe profile, confirmed with the AuthClient. Clears a dead session. */
export async function GET(req: NextRequest) {
  const check = checkSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!check.ok) {
    const res = fail("unauthorized");
    clearSession(res);
    return res;
  }
  try {
    const profile = await getAuthClient().me(check.session.token);
    return json({ ok: true, profile });
  } catch (err) {
    const code = toCode(err);
    const res = fail(code);
    if (code === "unauthorized") clearSession(res);
    return res;
  }
}
