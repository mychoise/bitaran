// DEV ONLY. Test accounts for mock mode. Every value here is fake.
// The mock refuses to run in a production build, so these can never ship.
// The same table is in README-dev-login.md. Never show these on a page.

import type { Profile } from "./types";

export const MOCK_PASSWORD = "test-pass-123";

export type MockAccount = { email: string; profile: Profile };

const BUSINESS = "Example Traders (fake)";

export const mockStaff: MockAccount[] = [
  { email: "owner@example.com", profile: { id: "u-owner", type: "staff", role: "owner", fullName: "Test Owner", businessName: BUSINESS } },
  { email: "manager@example.com", profile: { id: "u-manager", type: "staff", role: "manager", fullName: "Test Manager", businessName: BUSINESS } },
  { email: "salesman@example.com", profile: { id: "u-salesman", type: "staff", role: "salesman", fullName: "Test Salesman", businessName: BUSINESS } },
  { email: "salesman2@example.com", profile: { id: "u-salesman2", type: "staff", role: "salesman", fullName: "Test Salesman Two", businessName: BUSINESS } },
];

export const mockShops: MockAccount[] = [
  { email: "shop@example.com", profile: { id: "s-shop", type: "shop", name: "Test Kirana Pasal", businessName: BUSINESS } },
  { email: "shop2@example.com", profile: { id: "s-shop2", type: "shop", name: "Test General Store", businessName: BUSINESS } },
  { email: "shop3@example.com", profile: { id: "s-shop3", type: "shop", name: "Test Mini Mart", businessName: BUSINESS } },
];

/** Emails that force one error each, on either login, so every error screen can be seen. */
export const mockErrorEmails = {
  "locked@example.com": "rate_limited",
  "inactive@example.com": "account_inactive",
  "down@example.com": "unreachable",
} as const;
