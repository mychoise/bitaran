import "server-only";
import { randomBytes } from "node:crypto";
import { MOCK_PASSWORD, mockErrorEmails, mockShops, mockStaff, type MockAccount } from "./mock-accounts.dev";
import { AuthError, type AuthClient, type LoginResult, type Profile } from "./types";

const DELAY_MS = 600;
const wait = () => new Promise((r) => setTimeout(r, DELAY_MS));

// In-memory state, kept on globalThis so route handlers, pages and dev reloads share one copy.
// Password changes last until the dev server restarts and are never written to a file.
// Tokens are random and mapped to an account, like a real opaque token.
type MockState = { changedPasswords: Map<string, string>; tokens: Map<string, string> };
const holder = globalThis as typeof globalThis & { __bitaranMockAuth?: MockState };
const state = (holder.__bitaranMockAuth ??= { changedPasswords: new Map(), tokens: new Map() });
const { changedPasswords, tokens } = state;

const passwordFor = (a: MockAccount) => changedPasswords.get(a.profile.id) ?? MOCK_PASSWORD;

function findByToken(accessToken: string): MockAccount | undefined {
  const id = tokens.get(accessToken);
  return [...mockStaff, ...mockShops].find((a) => a.profile.id === id);
}

async function login(accounts: MockAccount[], email: string, password: string): Promise<LoginResult> {
  await wait();
  const normalised = email.trim().toLowerCase();
  const forced = mockErrorEmails[normalised as keyof typeof mockErrorEmails];
  if (forced) throw new AuthError(forced);
  const account = accounts.find((a) => a.email === normalised);
  // Unknown email and wrong password fail the same way, by design.
  if (!account || password !== passwordFor(account)) throw new AuthError("invalid_credentials");
  const accessToken = `mock_${randomBytes(18).toString("base64url")}`;
  tokens.set(accessToken, account.profile.id);
  return { accessToken, profile: account.profile };
}

export const mockAuthClient: AuthClient = {
  staffLogin: (email, password) => login(mockStaff, email, password),
  shopLogin: (email, password) => login(mockShops, email, password),

  async me(accessToken): Promise<Profile> {
    const account = findByToken(accessToken);
    if (!account) throw new AuthError("unauthorized");
    return account.profile;
  },

  async changePassword(accessToken, currentPassword, newPassword) {
    await wait();
    const account = findByToken(accessToken);
    if (!account) throw new AuthError("unauthorized");
    if (currentPassword !== passwordFor(account)) throw new AuthError("invalid_credentials");
    if (newPassword.length < 8) throw new AuthError("invalid_input");
    changedPasswords.set(account.profile.id, newPassword);
  },
};
