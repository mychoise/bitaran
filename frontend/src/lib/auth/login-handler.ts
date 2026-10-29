import "server-only";
import type { NextRequest } from "next/server";
import { landingFor } from "./areas";
import { getAuthClient } from "./index";
import { fail, isSameOrigin, json, readCredentials, setSession, toCode } from "./route-utils";
import { createSessionValue } from "./session";
import type { AuthClient } from "./types";

/**
 * POST handler shared by staff and shop login: checks the origin and the input, asks the
 * AuthClient, then sets the session cookie and says where to go. The password is never
 * logged, echoed or put in a URL.
 */
export async function handleLogin(req: NextRequest, kind: "staff" | "shop") {
  if (!isSameOrigin(req)) return fail("invalid_input");
  const creds = await readCredentials(req);
  if (!creds) return fail("invalid_input");

  let client: AuthClient;
  try {
    client = getAuthClient();
  } catch (err) {
    return fail(toCode(err));
  }

  try {
    const result = kind === "staff" ? await client.staffLogin(creds.email, creds.password) : await client.shopLogin(creds.email, creds.password);
    // A staff login must give a staff profile, a shop login a shop profile.
    if (result.profile.type !== kind) return fail("invalid_credentials");
    const res = json({ ok: true, redirectTo: landingFor(result.profile) });
    setSession(res, createSessionValue(result.accessToken, result.profile));
    return res;
  } catch (err) {
    return fail(toCode(err));
  }
}
