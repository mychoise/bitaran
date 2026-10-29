"use server";

import { cookies } from "next/headers";
import { messageFor } from "@/components/auth/messages";
import { getAuthClient } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/areas";
import { toCode } from "@/lib/auth/route-utils";
import { checkSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export type ChangePasswordState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string; field?: "currentPassword" | "newPassword" }
  | { status: "ended"; loginPath: string };

const MIN_LENGTH = 8;

/**
 * Server Function behind the change-password form. Next.js checks the request's Origin for
 * Server Functions. The token comes from the httpOnly cookie; passwords are never logged.
 * The session stays as it is, so the person remains signed in.
 */
export async function changePassword(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (!currentPassword) return { status: "error", field: "currentPassword", message: "Enter your current password." };
  if (newPassword.length < MIN_LENGTH)
    return { status: "error", field: "newPassword", message: `The new password needs at least ${MIN_LENGTH} characters.` };
  if (newPassword !== confirm) return { status: "error", field: "newPassword", message: "The two new passwords do not match." };

  const jar = await cookies();
  const check = checkSession(jar.get(SESSION_COOKIE)?.value);
  const end = (type?: "staff" | "shop"): ChangePasswordState => {
    jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return { status: "ended", loginPath: type ? LOGIN_PATH[type] : "/login" };
  };
  if (!check.ok) return end(check.type);

  try {
    await getAuthClient().changePassword(check.session.token, currentPassword, newPassword);
    return { status: "ok" };
  } catch (err) {
    const code = toCode(err);
    if (code === "unauthorized") return end(check.session.profile.type);
    if (code === "invalid_credentials") return { status: "error", field: "currentPassword", message: "Your current password is not right." };
    if (code === "invalid_input")
      return { status: "error", field: "newPassword", message: `The new password needs at least ${MIN_LENGTH} characters.` };
    return { status: "error", message: messageFor(code) };
  }
}
