# Dev login (mock mode)

With `AUTH_MODE=mock` (the default in development), login uses built-in fake accounts from
`src/lib/auth/mock-accounts.dev.ts`. Nothing is sent anywhere. A production server refuses to
start in mock mode, so these accounts can never ship.

## How accounts are created

There is **no sign-up page**, by design:

- A **new wholesale business** is set up by the company running Bitaran (that is the "Request a demo" route on the website). That creates the **owner** login.
- The **owner** (and managers) create logins for **managers, salesmen and shops**, and reset their passwords. Those screens are part of the app, which comes next, and the backend will provide the endpoints.
- Nobody can create their own account, and there is no "forgot password" email.

In mock mode you cannot create accounts either: use the sample accounts below. To add one,
copy a line in `src/lib/auth/mock-accounts.dev.ts` (give it a new `id` and an `@example.com`
email) and restart the dev server.

## Sample accounts

**Password for every account: `test-pass-123`**

Staff sign in at **http://localhost:3000/login/staff**:

| Email | Role | Business | Lands on |
| --- | --- | --- | --- |
| `owner@example.com` | Owner | Example Traders (fake) | `/app/manager` |
| `manager@example.com` | Manager | Example Traders (fake) | `/app/manager` |
| `salesman@example.com` | Salesman | Example Traders (fake) | `/app/salesman` |
| `salesman2@example.com` | Salesman | Example Traders (fake) | `/app/salesman` |

Shops sign in at **http://localhost:3000/login/shop**:

| Email | Shop | Buys from | Lands on |
| --- | --- | --- | --- |
| `shop@example.com` | Test Kirana Pasal | Example Traders (fake) | `/app/shop` |
| `shop2@example.com` | Test General Store | Example Traders (fake) | `/app/shop` |
| `shop3@example.com` | Test Mini Mart | Example Traders (fake) | `/app/shop` |

A staff email does not work on the shop login, and a shop email does not work on the staff
login. Both show the normal "not right" message.

## Error accounts (any password, either login)

| Email | Shows |
| --- | --- |
| `locked@example.com` | Too many attempts |
| `inactive@example.com` | Account switched off |
| `down@example.com` | Cannot reach the server |

Any other email, or a wrong password, shows "That email or password is not right."

## A quick test run

1. Start the dev server: `env -u NODE_ENV npm run dev` (your shell sets `NODE_ENV=production`).
2. Open http://localhost:3000 and click **Login**, then **I work here**.
3. Sign in as `manager@example.com` / `test-pass-123`. You land on the manager page.
4. Try http://localhost:3000/app/salesman: you are sent back to the manager page.
5. Click **Change password**, change it, then **Log out** and sign in with the new password.
6. Log in as `shop@example.com` on the shop login and try http://localhost:3000/app/manager: you are sent to the shop page.

## Notes

- Every mock call waits about 600 ms so loading states are visible.
- A changed password lasts until the dev server restarts. It is kept in memory only, never written to a file. Restarting the server puts every password back to `test-pass-123`.
