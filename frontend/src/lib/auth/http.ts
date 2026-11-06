import "server-only";
import { apiUrl } from "./env";
import { AuthError, type AuthClient, type AuthErrorCode, type LoginResult, type Profile, type StaffRole } from "./types";

// Sign-in against the real backend (API_URL), following docs/auth-contract.md. The backend
// answers errors as { error: { code, message } }; only the HTTP status decides what the person
// is told, so no backend wording ever reaches the screen. Passwords and tokens are never logged.

type BackendProfile =
  | { type: "staff"; id: string; role: StaffRole; fullName: string; business: { name: string } }
  | { type: "shop"; id: string; name: string; business: { name: string } };

function toProfile(p: BackendProfile): Profile {
  return p.type === "staff"
    ? { id: p.id, type: "staff", role: p.role, fullName: p.fullName, businessName: p.business.name }
    : { id: p.id, type: "shop", name: p.name, businessName: p.business.name };
}

/** 401 means a wrong email or password at login, and a dead token anywhere else. */
function codeFor(status: number, atLogin: boolean): AuthErrorCode {
  if (status === 401) return atLogin ? "invalid_credentials" : "unauthorized";
  if (status === 403) return "account_inactive";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "invalid_input";
  return "unreachable";
}

async function call<T>(path: string, init: RequestInit & { token?: string; atLogin?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AuthError("unreachable");
  }
  if (!res.ok) throw new AuthError(codeFor(res.status, Boolean(init.atLogin)));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function login(kind: "staff" | "shop", email: string, password: string): Promise<LoginResult> {
  const r = await call<{ accessToken: string; profile: BackendProfile }>(`/auth/${kind}/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
    atLogin: true,
  });
  return { accessToken: r.accessToken, profile: toProfile(r.profile) };
}

export const httpAuthClient: AuthClient = {
  staffLogin: (email, password) => login("staff", email, password),
  shopLogin: (email, password) => login("shop", email, password),
  me: async (token) => toProfile(await call<BackendProfile>("/auth/me", { token })),
  async changePassword(token, currentPassword, newPassword) {
    try {
      await call<void>("/auth/change-password", { method: "POST", token, body: JSON.stringify({ currentPassword, newPassword }) });
    } catch (err) {
      // Here a 401 means the current password was wrong, not that the session ended.
      if (err instanceof AuthError && err.code === "unauthorized") throw new AuthError("invalid_credentials");
      throw err;
    }
  },
};
