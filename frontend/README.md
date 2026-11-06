# Bitaran frontend

The website and the app for Bitaran, a field-sales tool for Nepali wholesalers. It covers:

- **Website:** the public pages and the login pages.
- **Manager and owner app:** day plans, sales, payments, shops, routes, products, returns, expenses, photos, reports, staff and settings.
- **Salesman app:** for phones.
- **Shop portal:** read-only, for the shops themselves.

It works against the real backend in `../backend` (NestJS) or, for demos and development without a backend, against an in-browser mock. `docs/backend-gaps.md` lists what the backend doesn't have yet.

Stack: Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, TanStack Query, react-hook-form with zod, and GSAP on the website only.

## Run it

```bash
cd frontend
npm install
cp .env.example .env.local      # optional: every value has a safe default
env -u NODE_ENV npm run dev     # http://localhost:3000; add -- -p 3001 if 3000 is taken
```

`env -u NODE_ENV` matters if your shell sets `NODE_ENV=production`. Mock mode refuses to run in production, and Next misbehaves when `NODE_ENV` is set by hand.

| Command | What it does |
| --- | --- |
| `env -u NODE_ENV npm run dev` | Development server, with mock sign-in and mock data |
| `env -u NODE_ENV npm test` | Unit tests for the business rules, dates and money (Node's own test runner) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `env -u NODE_ENV npm run build` | Production build |
| `npm start` | Production server; needs the real backend settings, see below |

Only one `next dev` can run in this folder at a time. If the dev server shows old styles after a change to `src/app/globals.css`, restart it.

## Demo logins (development only)

Every account's password is **`test-pass-123`**.

| Sign in at | Email | Lands on |
| --- | --- | --- |
| `/login/staff` | `owner@example.com` | `/app/manager` (and Settings, which only the owner sees) |
| `/login/staff` | `manager@example.com` | `/app/manager` |
| `/login/staff` | `salesman@example.com`, `salesman2@example.com` | `/app/salesman` |
| `/login/shop` | `shop@example.com`, `shop2@example.com`, `shop3@example.com` | `/app/shop` |

`README-dev-login.md` has the error accounts (locked, inactive, server down) and a short test run. The accounts live in `src/lib/auth/mock-accounts.dev.ts`.

## How mock mode works

Two server-only settings choose where sign-in and data come from. Both default to `mock`.

| Setting | `mock` | `api` |
| --- | --- | --- |
| `AUTH_MODE` | Sign-in checks the demo accounts in `src/lib/auth/mock.ts` | Sign-in calls the backend through `src/lib/auth/http.ts` |
| `API_MODE` | Screens read and write the in-browser demo store (`src/lib/api/mock/`) | Screens call the backend through `src/lib/api/http.ts` |

**Sign-in.** The login pages post to `/api/auth/staff/login` and `/api/auth/shop/login`. The server keeps the session in a signed **httpOnly cookie** (`bitaran_session`), never in localStorage. `src/proxy.ts` and `src/lib/auth/areas.ts` send each role to its own area and block the others.

**Data.**
- Every screen talks to one interface, `ApiClient` (`src/lib/api/client.ts`), through React Query hooks (`useApiQuery` and `useApiMutation` in `src/lib/api/provider.tsx`).
- `provider.tsx` picks the mock or the HTTP client from `API_MODE`.
- The mock (`src/lib/api/mock/index.ts`) enforces the same rules the backend must. They are in `src/lib/api/mock/rules.ts`, with tests in `rules.test.ts`, and some screens also import them for instant checks.
- Every mock call waits about 0.6 seconds, so the loading states are visible.

**Demo data.**
- `src/lib/api/mock/seed.ts` builds a fixed set of sample shops, products, day plans and so on.
- It's kept in this browser's localStorage under `bitaran:dev-only:demo-data`. That storage is for mock data only.
- When `DEMO_DATA_VERSION` in `seed.ts` changes, the store starts again from the seed.

**Dev menu** (in the "Demo data" ribbon at the top of the app):
- **Reset demo data** puts the starting data back.
- **Simulate a connection failure** makes every call fail in that tab, so you can check that each screen shows its error state with Retry.

**Production refuses mock.**
- `npm start` exits with a clear message in each of these cases: `AUTH_MODE` is `mock`, `API_MODE` is `mock`, or `SESSION_SECRET` is missing or under 32 characters (`src/instrumentation.ts`, `src/lib/auth/env.ts`).
- The mock and its test accounts are only loaded behind `process.env.NODE_ENV !== "production"`, so a production build doesn't contain them.

To check the build:

```bash
env -u NODE_ENV npm run build
grep -rl "test-pass-123" .next/static .next/server   # prints nothing
```

## Use the real backend

This is already wired up. `.env.local` (git-ignored) sets `AUTH_MODE=api`, `API_MODE=api` and `API_URL=http://localhost:3000/api/v1`.

1. Start the backend (`cd ../backend && npm run start:dev`; see its README for the database and the seed).
2. Restart this app's dev server, so it reads `.env.local`.
3. Sign in with the backend's own accounts, for example `owner@asva.test` (the backend's README lists them). The demo logins above only work in mock mode.

To go back to the demo data, set both modes to `mock` in `.env.local` and restart.

**How it's connected:**
- `src/lib/auth/http.ts` signs in against `API_URL`.
- `src/app/api/backend/[...path]/route.ts` forwards the browser's data calls to the backend, adding the token from the session cookie.
- `src/lib/api/http.ts` translates between the backend's shapes and the ones the screens use. Where the backend has no call, it shows "not available from the backend yet"; those calls are listed in `docs/backend-gaps.md`.

## How it was switched to the real backend

These are the steps that were taken; keep them in mind when the backend changes.

The backend contract is in `docs/api-contract.md` (data) and `docs/auth-contract.md` (sign-in). The table at the top of `api-contract.md` lists every call the UI makes, and which ones are new for the backend.

1. **Sign-in: `src/lib/auth/http.ts`.**
   - Replace the four stub methods of `httpAuthClient`: `staffLogin`, `shopLogin`, `me` and `changePassword`. Each one calls `API_URL` as `auth-contract.md` describes.
   - Map failures to `AuthError` codes. The mapping is in the file's comment: 401 → `invalid_credentials` or `unauthorized`, 403 → `account_inactive`, 429 → `rate_limited`, network → `unreachable`.
   - Nothing else changes. The route handlers in `src/app/api/auth/` and `src/lib/auth/login-handler.ts` already store the token in the session cookie.
2. **Data: a server route that adds the token.**
   - The browser can't read the httpOnly cookie, so it can't send the token itself.
   - Add `src/app/api/backend/[...path]/route.ts`. It reads the session with `checkSession(req.cookies.get(SESSION_COOKIE)?.value)` (see `src/app/api/auth/me/route.ts`).
   - It forwards the request to `${API_URL}/${path}` with `Authorization: Bearer <session.token>`.
   - It returns the response as it is, and clears the cookie on 401.
3. **Data: `src/lib/api/http.ts`.**
   - In `createHttpClient`, replace each `notConnected` stub with a call to `/api/backend/...`, following the method's row in `api-contract.md`.
   - The method names already match `ApiClient`, so TypeScript shows any method that's missing or has the wrong shape.
   - Turn error bodies (`{ error: { code, message } }`) into `ApiError` with the same codes: `not_found`, `forbidden`, `invalid`, `conflict`, `unreachable`. The screens already explain each one.
   - `uploads.image` sends multipart form data, and returns `{ id, url }`.
4. **Settings** (in `.env.local`, or the host's environment):
   ```bash
   AUTH_MODE=api
   API_MODE=api
   API_URL=https://your-backend.example        # server-only, never NEXT_PUBLIC_
   SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
   ```
5. **Check:** run `env -u NODE_ENV npm run build && npm start`, sign in with a real account, and walk each area.

**What stays:**
- `src/lib/api/mock/rules.ts` holds business rules that screens use for instant feedback, such as the credit-limit check and the payment checks. Keep it; the server still has the final say.
- The rest of `src/lib/api/mock/` and `src/lib/auth/mock*.ts` can stay for local development. Production never loads them.

## Where things are

| Path | What |
| --- | --- |
| `src/app/(site)/` | Website pages |
| `src/app/login/` | Login pages |
| `src/app/app/manager/`, `salesman/`, `shop/` | The three app areas, one folder per screen |
| `src/components/ui/` | The shared kit: buttons, fields, cards, table, dialogs, charts, camera |
| `src/components/app/` | App screens, by feature |
| `src/lib/api/` | `ApiClient`, its types, the HTTP stub and the mock |
| `src/lib/auth/` | Sessions, sign-in, role routing |
| `src/app/tokens.css`, `src/app/globals.css` | Design tokens and the website's classes; the app uses only these |
| `docs/api-contract.md`, `docs/auth-contract.md` | What the backend must provide |
| `docs/HANDOFF.md` | Notes for whoever picks the work up next: what's built, the rules, and the problems already hit |
| `docs/design-language.md` | The design audit and the token list |
