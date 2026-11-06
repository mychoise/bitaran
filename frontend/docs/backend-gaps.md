# Frontend and backend: what does not line up yet

The frontend is connected to the backend in `backend/` (NestJS, `http://localhost:3000/api/v1`). This page lists every place where the two still differ. It was checked on 5 Nov 2026 against the backend's code and its OpenAPI document (`/docs-json`).

The translation between the two lives in one file, `src/lib/api/http.ts`. Sign-in is in `src/lib/auth/http.ts`.

## Missing on the backend (the screen says "not available from the backend yet")

| What the UI needs | Where | Suggested call |
| --- | --- | --- |
| Uploading a product photo, the business logo, a PAN card photo | Product page, Settings, shop form | An upload call that returns a key for `imageKey`, `logoKey` and `panCardImageKey` (for example `POST /uploads/images`) |
| Changing an expense's bill photo after it was added | Expense page | Accept `receipt` on `PATCH /expenses/:id` |
| Deleting a route | Routes | `DELETE /routes/:id` (only when empty and never used) |
| Opening one visit photo | Not used by a screen yet | `GET /visit-photos/:id` |

## Worked around in the frontend (works now, but slower or less exact)

| What | How the frontend copes | Better fix on the backend |
| --- | --- | --- |
| A shop list with balances | One `GET /clients/:id/balance` call per shop | Balance, overdue and in clearing on each row of `GET /clients` |
| Each shop's route | Reads every route with `GET /routes/:id` | `routeId` on each shop |
| One visit by id (the salesman's visit screen) | Looks through `GET /day-plans/today` | `GET /visits/:id` with the shop and plan status |
| One expense by id (edit page) | Searches the newest 1,000 expenses | `GET /expenses/:id` |
| What a shop can still return | What it bought (`items-taken`), without taking off what it already returned | `GET /clients/:id/returnable` |
| The manager dashboard | Seven calls: today, pending payments, today's plans, flagged photos, overdue, low stock, and every shop's balance | `GET /reports/dashboard` |
| Sales per day (the dashboard's 14-day chart) | Reads every sale in the range | `GET /reports/sales-by-day?from&to` |
| The "Today" report for other dates | Reads the sales and cash payments in the range | `from` and `to` on `GET /reports/today` |
| Visit photos for a date range | `date` when both ends match, otherwise reads and filters | `from` and `to` on `GET /visit-photos` |
| Day plans for a date range | Same as photos | `from` and `to` on `GET /day-plans` |
| Expense summary for one person or type | Adds up the expense list in the browser | `userId` and `type` on `GET /expenses/summary` |
| A salesman's expenses in analytics | Adds up `GET /expenses?userId` | `expensesPaisa` in the analytics answer |
| Day plan lists | Lists come without stock lines or visits, so the list shows none | Fine as it is, unless the list should show visit counts |

## Added to the backend

On 5 Nov 2026 these were added in `backend/src/shop-portal/`, with tests in `test/shop-portal.e2e-spec.ts`:

- `GET /shop/me/invoices` and `GET /shop/me/invoices/:id`
- `GET /shop/me/payments`
- `GET /shop/me/returns`

A shop only ever gets its own records; another shop's invoice answers 404. Pending and bounced payments are included. Lines carry selling prices and the product's unit name, never cost, staff ids or plan ids.

## Different rules or shapes (decide which side changes)

- **Shops must have a login on the backend.** `POST /clients` requires `email` and `password`. The salesman's "new shop" form has no login fields, and the manager's form makes the login optional. Both now show "The backend needs a sign-in email and a temporary password for every new shop." Either make the login optional on the backend, or add the fields to the salesman's form.
- **Payments over what the shop owes.** The app stops a salesman taking more than the shop owes, less what's already in clearing (`collectable` in `rules.ts`). `POST /payments` doesn't check this yet, so another client could still record an overpayment.
- **No "days until due" per shop.** The frontend form still has the field. The backend ignores it, and sales default to 7 days unless a due date is given.
- **Cash counted at reconcile.** The backend compares the cash the salesman handed over with the cash expected; there is no separate count by the manager. The manager's "cash counted" figure on the reconcile screen is not sent, and the report shows the handed-over amount.
- **Visit photos:**
  - The backend flags a photo without camera (EXIF) data as `no_exif`. The app's live camera draws the Nepal time onto the picture, which produces an image with no EXIF data, so every photo from the app will be flagged "No photo data". Either the backend trusts its own receive time, or the app sends the capture time as a field.
  - The backend refuses the same photo sent twice. The app treated a repeat as a flag, not a refusal.
- **Returns:** a manager's changed credit is sent as a price per unit (`unitPricePaisa`), worked out from the value typed, so it can be off by a few paisa from rounding.
- **Salesman analytics:** pending payments come as an amount per method, not a count. The screen shows 0 pending, and shortage has no per-product breakdown.
- **Low stock:** there is no "sold in these dates" figure; the column says "Not available".
- **Overdue:** the backend never counts the opening balance as overdue (it has no due date). The demo data did.
- **Payment and sale cancellation details:** who decided a payment, when, and who cancelled a sale aren't returned, so those lines are blank.
- **Shop portal:** a shop can't read `GET /business`, so it sees only its supplier's name, without the address and PAN.

## Settings that matter

- **Login rate limit.** The backend allows 5 logins a minute per client address. Every login now comes from this app's server, so all users share one budget. To fix it, set `TRUST_PROXY=1` on the backend, and have the login route in `src/lib/auth/login-handler.ts` forward the visitor's address as `X-Forwarded-For`.
- **CORS** isn't needed: the browser only talks to this app, and this app's server talks to the backend.
- **Token lifetime:** the session cookie lasts 1 day, the same as the backend's `JWT_EXPIRY`. If the backend shortens it, the app sends the person to the login page with "your session ended" on the first call that fails.

## What was tested

Tested against the running backend with its seed data (one business, four staff, three shops, five products, no sales yet). Nothing was written to its database.

- **Sign-in:** the seeded owner, salesman and shop can sign in, and a wrong password gets the right message.
- **Pages:** 31 owner pages, 8 salesman pages and 6 shop pages load. The only messages are the shop's three "not available" lists.
- **Not tested yet:** every write. Creating a day plan, selling, collecting, returning, closing and reconciling need a test run that's allowed to add records.
