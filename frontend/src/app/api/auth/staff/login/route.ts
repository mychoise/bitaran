import type { NextRequest } from "next/server";
import { handleLogin } from "@/lib/auth/login-handler";

/** Owner, manager and salesman login. Body: { email, password }. */
export function POST(req: NextRequest) {
  return handleLogin(req, "staff");
}
