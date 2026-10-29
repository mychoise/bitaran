# Bitaran authentication contract

> **PROPOSED. Not yet verified against the real backend.**
> The frontend's login screens are built against the shapes below. They were designed on the
> frontend side; the backend team should confirm or correct each one before
> `AUTH_MODE=api` is switched on. Anything that changes here must also change in
> `src/lib/auth/types.ts` and `src/lib/auth/http.ts`.

## Overview

| Endpoint | Who | Auth |
| --- | --- | --- |
| `POST /auth/staff/login` | Owner, manager, salesman (one staff table) | none |
| `POST /auth/shop/login` | Shops (pasals), a separate table | none |
| `GET /auth/me` | Either kind | Bearer token |
| `POST /auth/change-password` | Either kind | Bearer token |

- One **access token**, valid for **1 day**. No refresh token. When it expires the person signs in again.
- **No password reset by email.** A manager or the owner resets a person's password (that endpoint is out of scope here).
- The frontend treats the token as opaque. It never reads inside it.
- All bodies are JSON (`Content-Type: application/json`).

## Accounts and registration

There is **no public registration endpoint** and no sign-up page. Accounts are created inside
the business:

- A new business and its **owner** account are created by the company running Bitaran during setup.
- The **owner** (and, if the backend allows it, managers) create **manager, salesman and shop** accounts and reset their passwords.

Those account-management endpoints are **not part of this contract**. They belong to the app's
staff and shop management screens, which come next. The login screens only need the four
endpoints below.

## Shared shapes

### Profile (the person's safe profile)

```jsonc
// staff
{ "id": "u_123", "type": "staff", "role": "owner" | "manager" | "salesman", "fullName": "Hari Example", "businessName": "Example Traders" }
// shop
{ "id": "s_456", "type": "shop", "name": "Example Kirana Pasal", "businessName": "Example Traders" }
```

`businessName` is the wholesale business the person belongs to (for a shop: the wholesaler it buys from).
No email, phone, password hash, cost data or anything else is included.

### Error body

```json
{ "error": { "code": "invalid_credentials" } }
```

The frontend writes every message the person sees, so the backend only needs to send a stable `code`.
A `message` field may be added for logs, but it is never shown.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `invalid_input` | Body missing or malformed |
| 401 | `invalid_credentials` | Login: wrong email **or** wrong password (always the same, see below) |
| 401 | `unauthorized` | Token missing, invalid or expired |
| 403 | `account_inactive` | The person's account, or their whole business, is switched off |
| 429 | `rate_limited` | Too many attempts. Please send `Retry-After` (seconds) |
| 400 | `wrong_current_password` | Change password: the current password is not right |
| 422 | `weak_password` | Change password: the new password breaks the rules (proposed minimum: 8 characters) |

## Endpoints

### `POST /auth/staff/login`

Request:

```json
{ "email": "owner@example.com", "password": "…" }
```

200 response:

```jsonc
{
  "accessToken": "…",
  "tokenType": "Bearer",
  "expiresIn": 86400,          // seconds
  "profile": { /* staff Profile */ }
}
```

Errors: `400 invalid_input`, `401 invalid_credentials`, `403 account_inactive`, `429 rate_limited`.

### `POST /auth/shop/login`

Same request and response as staff login, but checks the shop table and returns a shop Profile.
A staff email used here (or a shop email on the staff login) is simply `401 invalid_credentials`.

### `GET /auth/me`

Header: `Authorization: Bearer <accessToken>`

200 response: the Profile.

Errors: `401 unauthorized` (expired or invalid token), `403 account_inactive` (switched off since login).

### `POST /auth/change-password`

Header: `Authorization: Bearer <accessToken>`

Request:

```json
{ "currentPassword": "…", "newPassword": "…" }
```

204 response, no body. The current token stays valid, so the person stays signed in.

Errors: `400 wrong_current_password`, `422 weak_password`, `401 unauthorized`, `403 account_inactive`, `429 rate_limited`.

## Security expectations

- **Same answer for unknown email and wrong password**: same status, same code, and similar response time, so nobody can find out whether an email exists.
- **Rate limiting** on both login endpoints and change password (per IP and per email), answering `429` with `Retry-After`.
- **Deactivation**: a switched-off person, or any person in a switched-off business, gets `403 account_inactive` on login and on `/auth/me`.
- Passwords and tokens never appear in URLs or logs.
- CORS is not needed: the browser never calls the backend directly. Next.js route handlers on the website's server call it.

## How the frontend uses this (for reference)

```
Browser ── POST /api/auth/staff/login ──▶ Next.js route handler ── POST /auth/staff/login ──▶ backend
        ◀── Set-Cookie (httpOnly) ───────                       ◀── accessToken + profile ──
```

- The browser only talks to the website's own route handlers: `/api/auth/staff/login`, `/api/auth/shop/login`, `/api/auth/logout`, `/api/auth/me`.
- The handler keeps the access token and a trimmed profile in a signed, httpOnly, `SameSite=Lax` cookie (Secure in production) that lasts 1 day. The token is never in `localStorage`, `sessionStorage` or a URL.
- A Next.js proxy uses the cookie's profile only to send people to the right screen. **The backend is the authority** for every real permission check.
- Change password is a Next.js Server Function that calls `POST /auth/change-password` with the token from the cookie.
- Logout clears the cookie. If the backend later adds `POST /auth/logout` to revoke tokens, the logout handler will call it.
