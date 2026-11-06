# Bitaran frontend: handoff

State of the work as of 5 Nov 2026 (through Step 12, the polish and hand-over pass), for an agent picking it up. Everything lives in `frontend/`.

## Ground rules from the owner (follow them exactly)

- **Scope:** do not read, edit or run anything outside `frontend/`. There is no backend connection; all app data comes from the in-browser mock.
- **Design:** copy the existing website design. No new theme, no UI component library.
  - Reuse the kit in `src/components/ui/`.
  - New tokens only with the owner's approval.
  - No hard-coded hex colours, no arbitrary-value Tailwind classes (`w-[13px]` and the like), no inline `style=` in markup.
- **Packages:** the approved ones are `@tanstack/react-query`, `react-hook-form`, `zod`, `recharts` and `date-fns`. The owner also asked for `gsap`. **Ask before adding anything else.**
- **Truth:** never invent customers, statistics or claims. Demo data is labelled "demo" or "example".
- **Every page** has loading, empty and error-with-Retry states, and is noindex (set in `src/app/app/layout.tsx`).
- **Tables:** sticky header, sorting, filters in the URL, CSV export.
- **Destructive actions** go through `ConfirmDialog`.
- **Accessibility:** labelled fields, keyboard-operable controls, visible focus.
- **Passwords:** never put one in a URL, log it or store it. The mock checks temporary passwords and then drops them.
- **How to work:** one step at a time. After each step, stop and report in this format:
  1. Pages and components created or changed (route list)
  2. Mock rules added or changed, with their tests and results
  3. Entries added to `docs/api-contract.md`
  4. What to click through to review (short checklist)
  5. Assumptions and deviations

  Run lint, the type check, `npm test` and `npm run build` before reporting.

## Stack and commands

- Next.js 16.4.3 (App Router, Turbopack, `cacheComponents: true`), React 19.3, TypeScript, Tailwind 4.
- Also: React Query 5, react-hook-form 7, zod 4, GSAP 3.15 (website only).
- **Read `AGENTS.md`:** this Next version differs from older ones. The docs are in `node_modules/next/dist/docs/`.
  - `proxy.ts` replaces middleware.
  - Request data (`cookies()`, `params`, `searchParams`, `useSearchParams`) must be read inside `<Suspense>`.
  - `PageProps<"/route">` is a global type.
- **The shell sets `NODE_ENV=production`,** so prefix commands with `env -u NODE_ENV`:
  ```
  env -u NODE_ENV npm run dev        # http://localhost:3000
  env -u NODE_ENV npm run lint
  env -u NODE_ENV npx tsc --noEmit   # after adding routes, run a build first to regenerate route types
  env -u NODE_ENV npm test           # Node's built-in runner, 73 tests
  env -u NODE_ENV npm run build
  ```
- **Production refuses mock modes.** `AUTH_MODE=mock` or `API_MODE=mock` exits at start-up (`src/instrumentation.ts`, `src/lib/auth/env.ts`). Website pages can be checked in production with `AUTH_MODE=api API_MODE=api SESSION_SECRET=<32+ chars> npx next start -p 3200`. App pages need dev mode, because mock login only works there.
- **Only one `next dev` per folder.** The owner often runs one on port 3001; test against it rather than stopping it. Check for a running one before starting another.

## Test logins (dev only)

Every account's password is `test-pass-123` (see `README-dev-login.md`).

| Account | Lands on |
| --- | --- |
| `owner@example.com` | `/app/manager` (sees Settings) |
| `manager@example.com` | `/app/manager` |
| `salesman@example.com`, `salesman2@example.com` | `/app/salesman` |
| `shop@example.com`, `shop2@example.com`, `shop3@example.com` | `/app/shop` |

The session is a signed httpOnly cookie (`bitaran_session`), never localStorage.

## Architecture

- **`src/lib/api/client.ts`:** the `ApiClient` interface, the only way screens get data, plus input and filter types and `ApiError` (codes `not_found`, `forbidden`, `invalid`, `conflict`, `unreachable`, `not_built_yet`).
- **`src/lib/api/types.ts`:** domain types.
  - Money is **integer paisa**.
  - Business dates are Nepal `YYYY-MM-DD`; instants are ISO strings.
- **`src/lib/api/mock/`:** the in-browser mock, persisted in localStorage under `bitaran:dev-only:demo-data`. Mock data only; the session never goes there.
  - `rules.ts`: business rules as pure functions, tested in `rules.test.ts`. The mock obeys them, and the backend must too.
  - `seed.ts`: deterministic demo data. `DEMO_DATA_VERSION` is 10 (it includes the idempotency store, a photo with no camera time, and three months of salaries); bump it when the data's shape changes.
  - `index.ts`: `createMockClient(viewer)`. **Every answer is a `structuredClone`**: the store's objects never reach the screens, so in-place changes are seen as new data by React Query. It is role-scoped: salesmen see their own records, and cost price is stripped for non-managers. Not-yet-built writes throw `not_built_yet`.
  - `store.ts`: storage and reset.
- **`src/lib/api/http.ts`:** stub client; every method throws "Backend not connected yet".
- **`src/lib/api/schemas.ts`:** zod input checks shared by the forms and the mock.
- **`src/lib/api/provider.tsx`:**
  - `ApiProvider` (mode from the server's `API_MODE`)
  - `useApiQuery(key, run)` (keys scoped to the viewer)
  - `useApiMutation(run, invalidates)`
  - `errorMessage(err)`
- **Helpers in `src/lib/`:**
  - `money.ts`: lakh grouping ("Rs 1,23,456.00"), "Credit Rs X" for negative balances, `parseRupees`, `parseSignedRupees`.
  - `dates.ts`: Nepal time zone, shown in AD.
  - `units.ts`: "2 cartons + 17 cups".
  - `forms.ts`: a `zodResolver` with no extra package.
  - `url-state.ts`: `useUrlState`, `parseSort`, `formatSort`.
  - `images.ts`: shrinks images in the browser before upload.
- **`docs/api-contract.md`:** every call with method, path, request, response, who may call it and status (**Planned**, **Planned?** or **NEW**), plus the rules the backend must enforce and a change log per step. **Keep it updated in every step.**
- **`docs/design-language.md`:** the design audit (Step 0). Use it for tokens and patterns.

### UI kit (`src/components/ui/`)

- **Basic pieces:** `Button` (+ `buttonClass`, accepts `ref`), `Field`/`Input`/`Select`/`Textarea`/`Checkbox`, `Card`, `Stat`, `PageHeader`, `Badge`, `StatusBadge` (one map of record statuses), `MoneyText`, `Skeleton`.
- **States:** `EmptyState`, `ErrorState` (with Retry), `LoadingState`.
- **Tables:** `Table` (sticky header, sorting, `csvOnly` columns), `ExportButton`, `Pagination`.
- **Controls:** `Tabs`, `Segmented`, `Stepper`, `DateRangePicker`, `DemoImage`, `ImageViewer`.
- **Overlays:** `Modal`, `Drawer`, `ConfirmDialog`, `useToast`.
- **Forms and images:** `BackLink`, `FormProblem`, `ImagePicker` (+ `ImageChange`).
- **Style guide:** `/dev/ui` (dev only).
- **Shells (`src/components/app/Shells.tsx`):**
  - Manager and owner: a sidebar from 1024px, a Menu drawer below.
  - Salesman and shop: bottom tabs on phones, a sidebar from 1024px.
  - Demo ribbon with "Reset demo data" in the dev menu.
  - The nav is `src/components/app/nav.ts`. Every section has its own route folder.

## Done so far

| Step | What |
| --- | --- |
| Website | Home, Features, Services, How it works, Pricing, Contact, Privacy, Terms. Login pages (mock auth). |
| 0 | Design audit (`docs/design-language.md`); 10 tokens approved (status and chart colours). |
| 1 | App shells for each audience, role routing (`proxy.ts` + `src/lib/auth/areas.ts`), the UI kit, the ApiClient, mock, seed and rules, React Query, home screens for each area. |
| 2 | **Staff:** `/app/manager/staff`, `/staff/new`, `/staff/[id]`. **Settings** (owner only): `/app/manager/settings`, with logo upload and a read-only PAN. |
| 3 | **Products:** `/app/manager/products`, `/products/new`, `/products/[id]` (image, cost and margin, Adjust stock), `/products/categories`. |
| 4 | **Routes:** `/app/manager/routes`, `/routes/[id]` (reorder with keyboard buttons or drag, add and remove, Save replaces the list). **Shops:** `/app/manager/shops`, `/shops/new`, `/shops/[id]`. |

| 5 | **Day plans** (manager): `/app/manager/day-plans` (filters: date with a Today shortcut, salesman, status), `/day-plans/new` (pieces or cartons per line, warehouse stock shown, live over-issue check, duplicate check, summary and confirm), `/day-plans/[id]` (timeline, stock, visits, that day's sales and payments, delete while planned), `/day-plans/[id]/reconcile` (manager's count with live shortage, cash check, notes, confirm; afterwards a read-only printable end-of-day report). |
| 6 | **Salesman app, part 1** (phone first): `/app/salesman` (Today: planned with Start day, in progress with progress and totals, closed summary, or no plan), `/salesman/shops` (route in order, search, ad-hoc visit, new shop), `/salesman/shops/new`, `/salesman/shops/[visitId]` (balance card, today's purchases, items taken, Mark visited, Skip with reason; sale, payment, return and photo buttons shown but not built), `/salesman/stock`, `/salesman/close-day` (guided: shops, stock left with steppers, cash, review, confirm, then a read-only summary). |
| 7 | **Salesman app, part 2:** `/salesman/sale/new?visit=` (picker with search, category chips, piece or carton, a stepper capped at stock, a sticky total; review with discount, due date, cash now and the credit check; invoice with print and share), `/payment/new?visit=` (cash, cheque, online; live camera), `/return/new?visit=`, `/visit-photo?visit=` (live camera, Nepal time burned in, flags shown neutrally), `/history`, `/today`, `/analytics` (SVG bar chart with a table view), `/expenses`, `/more`. |
| 8 | **Manager records:** `/app/manager/sales` (filters: dates, salesman, shop, status; CSV), `/sales/[id]` (printable invoice with the business PAN, paid and still owed, linked payments; Cancel sale with a required reason, blocked with the reason when it has confirmed payments), `/payments` ("Pending (n)" first), `/payments/[id]` (images in an ImageViewer, Confirm or Mark bounced through ConfirmDialogs, read-only once decided), `/returns`, `/returns/new` (manager return against a shop), `/returns/[id]`, `/write-offs`, `/write-offs/new` (optional open day plan; with one, warehouse stock is not lowered again), `/photos` (review grid: dates, salesman, flagged only; flags in plain words, distance, time, link to the day plan). Components in `src/components/app/records/`. |
| 9 | **Expenses** (owner and manager): `/app/manager/expenses` (filters: dates, type, person; a totals row; CSV), `/expenses/new` and `/expenses/[id]` (one form: type, amount, date, staff member, the day plan for fuel and khaja, the month for salary, description, optional bill photo; the edit page notes that no edit history is kept), `/expenses/summary` (totals by type, a by-month chart, and a month × type table). Components in `src/components/app/expenses/`. The kit `Table` gained a `totals` row. |
| 10 | **Dashboard and reports:** `/app/manager` (tiles linking to detail: sales today, cash today, payments waiting, flagged photos, day plans by status, top 5 overdue shops, low stock, and a 14-day sales chart), `/reports` (hub), `/reports/today` (`?from&to`, default today), `/reports/salesman-history`, `/reports/salesman-analytics` (salesman and dates in the URL), `/reports/overdue`, `/reports/low-stock` (with units sold in the dates). Every report keeps a date range in the URL and has CSV and Print. Components in `src/components/app/reports/`. The manager `[section]` catch-all was removed because every section is built. |
| 11 | **Shop portal** (read-only): `/app/shop` (owed or credit, credit limit and how much is used, overdue, last payment, recent activity), `/shop/statement` (running balance, dates in the URL, printable), `/shop/invoices` and `/shop/invoices/[id]` (printable), `/shop/payments` (status filter, each status explained), `/shop/returns`, `/shop/profile` (details, PAN only if set, a link to `/app/change-password`). Components in `src/components/app/shop/Portal.tsx`. The shop calls return shop-only shapes (`ShopInvoice`, `ShopPayment`, `ShopReturn`): names instead of ids, no cost prices. Another shop's invoice id is "not found". `Homes.tsx`, `ComingNext.tsx` and the last `[section]` catch-all were removed: every section is built. |
| 12 | **Polish and hand-over.** Every page was walked as each login, with `axe` accessibility checks, overflow and overlap checks at 360, 1024 and 1280 px, link checks and role-access checks. Every print layout was checked as A4 PDF. Fixes: error states for forms whose lookups fail, print CSS (wrapping headers, no buttons, no sort icons), a business header on the salesman's invoice, accessible names for image thumbnails, one non-token colour (`text-danger`), and the mock and test accounts kept out of production builds. Added the dev-menu "Simulate a connection failure" switch, `README.md`, and the call table at the top of `docs/api-contract.md`. |

The shop detail page has a balance card and tabs: Statement (date range, printable), Sales, Payments, Returns, Items taken, Details (edit, reset password, deactivate).

### Rules in place (all in `rules.ts`, tested)

- **Shop balance:** `opening + confirmed sales − confirmed payments − returns`. Pending cheque and online payments are "in clearing"; bounced ones never count. Overdue is paid off oldest first. Credit used is flagged when over the limit.
- **Credit limit:** blocks a salesman; owner and manager may override.
- **Sales:**
  - Prices come from the product record.
  - Invoice numbers are sequential.
  - A sale with a confirmed payment can't be cancelled.
- **Day plans:**
  - The lifecycle is planned → in progress → closed → reconciled, one step at a time.
  - Each salesman has one plan in progress at a time.
  - Shortage uses the manager's count.
- **Payments:**
  - A cheque needs a number and a photo; an online payment needs a screenshot.
  - The same image can't be used twice.
  - A payment is decided once.
- **Returns:** damaged and expired goods are never restocked.
- **Staff:**
  - The owner adds managers and salesmen; a manager adds salesmen only.
  - There is exactly one owner, who can't be deactivated or change role.
  - Nobody deactivates or resets their own account here.
  - Emails are unique.
- **Products:**
  - Prices are zero or more.
  - Units per carton is above zero when set (the carton is optional).
  - SKUs are unique.
  - Stock is in base units with the carton equivalent shown, and adjustments can't go below zero (not logged yet).
  - Products are deactivated, never deleted.
- **Categories:** names are unique (an assumption, not yet confirmed); a category is deleted only when unused.
- **Shops:**
  - PAN is optional, 9 digits, unique within the business.
  - The shop login email is unique, and comes with a temporary password.
  - Location is both latitude and longitude or neither.
  - A shop a salesman adds starts with zero credit limit and zero opening balance.
  - Shops are deactivated, never deleted.
- **Day plans:**
  - One plan per salesman, route and date, for today or later.
  - Issuing can't take more than the warehouse holds (lines for the same product are added up), and lowers stock straight away. Deleting a planned day restores it.
  - Reconcile needs a closed plan, with every product counted and no count above what could be left. The counted stock goes back to the warehouse.
  - Cash collected = confirmed cash payments on the plan; difference = counted − collected.
- **Cancelling a sale** (manager only): a reason is required; a confirmed payment blocks it. The goods go back to the salesman's stock while the plan is in progress or closed, otherwise to the warehouse.
- **Write-offs** (manager only): pieces or cartons; can't exceed what is held (warehouse, or the plan's remaining stock). Warehouse stock drops only when there is no plan.
- **Expenses:** salary needs a staff member and the month it covers; the amount is above zero; only fuel and khaja go on a day plan, which must be that person's. Totals are by type and by the month of the expense date.
- **Reports:** a day's totals count confirmed sales and confirmed cash. Shortage covers reconciled plans (issued − sold − back − written off), counts only shortfalls, and is valued at the unit price. Salesman history includes every status.
- **Photo flags:** old photo (camera time over 15 minutes before sending), too far (over 250 m from the shop), same as an earlier photo, no photo data (no camera time). Flags never block saving.
- **Routes:**
  - A shop is on at most one route (or none: `routeId: null`).
  - Saving a route replaces its ordered list, and shops added leave their old route.
  - A route is deleted only when empty and never used by a day plan.

### Website extras (after the steps, at the owner's request)

- **Smooth scrolling** with GSAP ScrollSmoother: `src/components/site/SmoothScroll.tsx`.
  - Off on touch screens and for reduced motion.
  - The header and fixed elements stay outside the smoothed content.
  - Page changes reset to the top.
  - The content is on its own GPU layer for performance.
- **Pokhara route rail** in the left margin (`ScrollRoute.tsx`):
  - A different set of Pokhara places on each page.
  - One stop per page section, reached as that section scrolls into view; clicking a stop scrolls to it.
  - Hidden below 1024px.
- **How it works:**
  - The phone stays pinned through the day's four parts while its screen changes (`src/components/how/DayScroller.tsx`).
  - "Who does what" is a role explorer with tabs (`RoleExplorer.tsx`).

## Not built yet (next steps)

Every screen in the nav is built, for every audience. Every mock write is built too (`notBuiltYet` was removed in Step 8).

The owner pastes each step's brief. Don't start a step until it arrives.

## Connected to the real backend (after Step 12)

- `.env.local` sets `AUTH_MODE=api`, `API_MODE=api` and `API_URL=http://localhost:3000/api/v1`. Restart the dev server after changing it.
- Sign-in uses `src/lib/auth/http.ts`. Data goes browser → `/api/backend/*` (`src/app/api/backend/[...path]/route.ts`, adds the token) → backend. The translation is all in `src/lib/api/http.ts`.
- The backend's seeded logins are `owner@asva.test` / `Owner@12345`, `salesman1@asva.test` / `Salesman@12345` and `shop1@asva.test` / `Shop@12345`.
- `docs/backend-gaps.md` lists what's missing, what's worked around and the rules that differ. Writes against the real backend are untested.

## Gotchas learned the hard way

- **Next keeps pages already visited in the page, hidden** (for instant back navigation). Anything that searches the page (`querySelectorAll`) must skip hidden elements; see `isShown` in `ScrollRoute.tsx`.
- **CSS `sticky` does nothing inside ScrollSmoother.** Pin with ScrollTrigger instead (see `DayScroller.tsx`). Same-page `#hash` links go through `smoother.scrollTo` (`SmoothScroll.tsx`).
- **Prerendering:** Cache Components fails on `new Date()` during render in prerendered components. Call `await io()` or `use(io())` from `next/cache` first.
- **Routes:** a page with a dynamic `[id]` reads `params` inside a child component wrapped in `<Suspense>`. A static folder (like `products/categories`) wins over `[id]`.
- **React 19:** components get `ref` as a normal prop; declare it in the props type when you need it.
- **Printing:** `.no-print` hides app chrome; in print, tables lose their sideways scroll and shrink to fit A4.
- **`Card` forwards HTML attributes** (`aria-label`, `aria-labelledby`); use them to name sections.
- **Every create takes an `idempotencyKey`** (`useOnceKey` in `components/app/salesman/onVisit.tsx`, renewed after a success). `useSingleFlight` blocks a second tap while a submit runs. The mock's `once()` returns the first result for a repeated key.
- **Camera** (`components/ui/Camera.tsx`) uses `getUserMedia`. The file picker shows only in development. To test headless: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`.
- **The owner's dev server can serve an old stylesheet** after `globals.css` changes; a restart fixes it. To check styles, use a production build, or inject `.next/static/chunks/*.css` into the page.
- **Kit `Tabs` renders every panel.** Pass `null` content for tabs that aren't open, to avoid loading every tab's data (see `ShopDetail.tsx`).
- **Inputs in tests:** clear a field with Ctrl+A then Backspace; triple-click doesn't select a whole `type=search` value. Headless Brave reports no mouse, so to test smooth scrolling launch it with `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`.
- **Script edits:** when changing a file with a script, check the text being replaced occurs exactly once. A first-match replace once wiped a large part of `mock/index.ts`; it was recovered from the dev server's source maps (`.next/dev/**/*.js.map`, `sourcesContent`).
- **Build type errors about a deleted route** come from a stale `.next/dev/types/validator.ts`. Run `next dev` briefly to regenerate it.
- **Production builds contain no mock.** `getAuthClient` (`src/lib/auth/index.ts`), `ApiProvider` and the dev menu load the mock only behind `process.env.NODE_ENV !== "production"`. Keep it that way, and check with `grep -rl "test-pass-123" .next` after a build.
- **Error states:** turn on "Simulate a connection failure" in the dev menu (`src/lib/api/mock/flags.ts`). Every screen that loads data must then show "This did not load" with Retry. `usePlanLookups` returns `error` and `retry` for this.
- **Git:** never touch the owner's git index (no `git rm --cached`, no staging). Commit only when asked.

## Uncommitted right now

The last commit is `6957e57 feat: added product` (Step 3). Uncommitted:
- **Steps 4 to 12:** routes and shops; day plans and reconcile; salesman app parts 1 and 2; manager sales, payments, returns, write-offs and photos; expenses; the dashboard and reports; the shop portal; the Step 12 polish, `README.md` and the contract table. Each comes with its rules, tests and contract entries.
- **Website extras:** GSAP smooth scrolling, the route rail, the How it works phone and role explorer, and the `gsap` package.
