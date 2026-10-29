// The shapes every auth implementation (mock now, real backend later) must speak.
// They mirror docs/auth-contract.md. Keep the two in step.

export type StaffRole = "owner" | "manager" | "salesman";

/** The logged-in person's safe profile, as GET /auth/me returns it. */
export type Profile =
  | { id: string; type: "staff"; role: StaffRole; fullName: string; businessName: string }
  | { id: string; type: "shop"; name: string; businessName: string };

export type LoginResult = { accessToken: string; profile: Profile };

/** Every failure the screens know how to explain. Nothing else ever reaches the user. */
export type AuthErrorCode =
  | "invalid_credentials" // wrong email or wrong password: the same code for both
  | "rate_limited" // too many attempts (HTTP 429)
  | "account_inactive" // the person or the business is switched off
  | "unreachable" // the backend could not be reached
  | "unauthorized" // no session, or the session ended
  | "invalid_input"; // the request itself was malformed

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

/** One small interface in front of authentication. */
export interface AuthClient {
  /** POST /auth/staff/login: owner, manager or salesman. */
  staffLogin(email: string, password: string): Promise<LoginResult>;
  /** POST /auth/shop/login: shops (pasals). */
  shopLogin(email: string, password: string): Promise<LoginResult>;
  /** GET /auth/me with the access token. */
  me(accessToken: string): Promise<Profile>;
  /** POST /auth/change-password with the access token. */
  changePassword(accessToken: string, currentPassword: string, newPassword: string): Promise<void>;
}

/** Display name for either kind of profile. */
export const displayName = (p: Profile) => (p.type === "staff" ? p.fullName : p.name);
