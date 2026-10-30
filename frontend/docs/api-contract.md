# Bitaran app API contract

> **PROPOSED. Not yet verified against the real backend.** Built step by step as the screens
> need each call. Source of truth on the frontend: `src/lib/api/client.ts` (the `ApiClient`
> interface) and `src/lib/api/types.ts` (the shapes). Business rules both sides must enforce:
> `src/lib/api/mock/rules.ts` (with tests).

**Status column:**
- **Planned** means you confirmed the backend plans this call.
- **Planned?** means I do not have the backend plan in front of me; I assume the backend plans it. Please confirm or correct.
- **NEW** means the UI needs it and the backend plan (as described to me) does not have it yet. A planned call can carry a NEW field or parameter; those are named in the row.

## Conventions

- All calls carry the logged-in person's token (`Authorization: Bearer …`), see `auth-contract.md`. The server scopes every answer by who is asking; the UI's checks are only a convenience.
- **Money is integer paisa** (`12345650` = Rs 1,23,456.50). Never decimals.
- **Business dates** are Nepal (Asia/Kathmandu) calendar dates, `"YYYY-MM-DD"`. **Instants** are ISO 8601 strings in UTC.
- **Lists** take `?page=1&pageSize=25` and return `{ items, total, page, pageSize }`. Date filters are `from` and `to` (inclusive).
- **Errors:** `{ "error": { "code": "...", "message": "..." } }`. Codes: `not_found` (404), `forbidden` (403), `invalid` (400/422, message names the problem in plain words), `conflict` (409, for rule violations such as cancelling a sale with a confirmed payment), `unauthorized` (401).
- **Cost price** (`costPricePaisa`) is only ever sent to the owner and managers.
- Roles: **O** owner, **M** manager, **S** salesman (own records only), **Sh** shop (own records only).

## Business

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/business` | | `Business` | O M S Sh | Planned |
| PATCH | `/business` | partial `{ name, phone, email, address, city, registrationNo, logoImageId }`; `logoImageId: null` removes the logo | `Business` | O | Planned |

`Business { id, name, pan, phone, email, address, city, registrationNo, logoImageId?, logoUrl? }`. `registrationNo` may be `""`.
- **`pan` is read-only:** a PATCH that includes it must be refused (`invalid`).
- `logoUrl` (**NEW**) is sent by the server so the UI can show the logo without a second call.
- Checks (same as `src/lib/api/schemas.ts`): name 1–120 characters, phone 8–20 digits/spaces/dashes with an optional leading `+`, a valid email (stored lower-case), address 1–200, city 1–80, registration number up to 50.

## Uploads

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/uploads/images` | `multipart/form-data`, one `file` (PNG, JPEG or WebP) | `{ id, url }` | O M S | **NEW** |

The returned `id` is then attached to a record (business logo now; product images, cheque photos, screenshots, bills and visit photos later). The app shrinks images in the browser before uploading (logo: 512 px on the longest side). Suggested server limit: 5 MB.

## Staff

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/staff` | `?search&role&active` (**NEW** filters; search matches name, email or phone) | `Staff[]` (a salesman gets only himself) | O M (S self) | Planned |
| GET | `/staff/:id` | | `Staff` | O M (S self) | Planned |
| POST | `/staff` | `{ fullName, role: "manager" \| "salesman", email, phone, temporaryPassword }` (`temporaryPassword` **NEW**) | `Staff` | O (M: salesmen only) | Planned |
| PATCH | `/staff/:id` | partial `{ fullName, role, email, phone, active }` | `Staff` | O (M: salesmen only) | Planned |
| POST | `/staff/:id/reset-password` | `{ temporaryPassword }` | 204 | O (M: salesmen only), never for yourself | Planned |

`Staff { id, fullName, role, email, phone, active, joinedOn, lastLoginAt?, passwordResetAt? }`.
- `passwordResetAt` is **NEW**. It lets the screen show when a temporary password was last set.
- Passwords are never returned, stored in plain text or logged.

Rules (tested in `rules.ts`):
- **Who adds whom:** the owner adds managers and salesmen; a manager adds salesmen only.
- **Who edits whom:** a manager changes salesmen only; the owner changes anyone.
- **Exactly one owner.** The owner cannot be deactivated or given another role, and nobody can be made owner (`forbidden`).
- **Yourself:** nobody deactivates their own account or resets their own password here. Your own password goes through Change password (`auth-contract.md`).
- **Email is unique** across staff, ignoring case and spaces at the ends: `conflict`, "Someone on your staff already uses this email."
- **A temporary password** is 8 to 200 characters. A reset makes the old password stop working.
- **Nothing is deleted.** A deactivated person cannot sign in, but their sales, payments and day plans stay.

## Products

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/categories` | | `Category[]` | O M S | Planned? |
| GET | `/products` | `?categoryId&search&lowStock&page&pageSize` | `Page<Product>` (no cost price for S) | O M S | Planned? |
| GET | `/products/:id` | | `Product` | O M S | Planned? |
| POST | `/products` | `ProductInput` | `Product` | O M | Planned? |
| PATCH | `/products/:id` | partial `ProductInput` | `Product` | O M | Planned? |

`Product { id, name, categoryId, unitName, unitsPerCarton, unitPricePaisa, cartonPricePaisa, costPricePaisa?, stockUnits, lowStockUnits, active }`. Stock is in base units.

## Shops and routes

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/routes` | | `Route[] { id, name, shopIds (in visiting order) }` | O M S | Planned? |
| GET | `/shops` | `?routeId&search&overdue&page&pageSize` | `Page<ShopWithBalance>` | O M S | Planned? |
| GET | `/shops/:id` | | `ShopWithBalance` | O M S | Planned? |
| GET | `/shops/:id/statement` | `?from&to` | `StatementEntry[]` | O M | Planned? |
| POST | `/shops` | `ShopInput` | `ShopWithBalance` | O M | Planned? |
| PATCH | `/shops/:id` | partial `ShopInput`, plus `active` | `ShopWithBalance` | O M | Planned? |

`ShopWithBalance` adds `balancePaisa` (opening + confirmed sales − confirmed payments − returns; negative = credit), `inClearingPaisa` (pending cheque/online) and `overduePaisa` (past-due unpaid, oldest first) to the shop. **The server computes these.**

## Day plans

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/day-plans` | `?salesmanId&status&from&to&page&pageSize` | `Page<DayPlan>` | O M (S own) | Planned? |
| GET | `/day-plans/:id` | | `DayPlan` | O M (S own) | Planned? |
| GET | `/day-plans/today` | | `DayPlan \| null` (the salesman's plan in progress, else today's) | S | **NEW** |
| POST | `/day-plans` | `{ date, salesmanId, routeId, issued: StockLine[] }` | `DayPlan` (issuing lowers warehouse stock) | O M | Planned? |
| DELETE | `/day-plans/:id` | | 204 (planned only; stock restored) | O M | Planned? |
| POST | `/day-plans/:id/start` | | `DayPlan` (one in progress per salesman) | S | Planned? |
| POST | `/day-plans/:id/visits/:shopId` | `{ status: "visited" \| "skipped", skipReason? }` | `DayPlan` | S | Planned? |
| POST | `/day-plans/:id/close` | `{ reportedUnsold: StockLine[], cashHandedOverPaisa }` | `DayPlan` (all visits done) | S | Planned? |
| POST | `/day-plans/:id/reconcile` | `{ counted: StockLine[], cashCountedPaisa }` | `DayPlan` (manager's count wins) | O M | Planned? |

Lifecycle: `planned → in_progress → closed → reconciled`, one step at a time.

## Sales

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/sales` | `?shopId&salesmanId&planId&status&from&to&page&pageSize` | `Page<Sale>` | O M (S own) | Planned? |
| GET | `/sales/:id` | | `Sale` | O M (S own) | Planned? |
| POST | `/sales` | `{ shopId, planId?, lines: [{ productId, quantity, unit: "unit" \| "carton" }], overrideCreditLimit? }` | `Sale` | O M S | Planned? |
| POST | `/sales/:id/cancel` | `{ reason }` | `Sale` | O M | Planned? |

Prices come from the product record on the server, never from the request. Invoice numbers are sequential per business and never reused. Over the credit limit: `409 conflict` for a salesman; owner/manager may send `overrideCreditLimit: true`. A sale with a confirmed payment cannot be cancelled (`409`).

## Payments

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/payments` | `?shopId&salesmanId&method&status&from&to&page&pageSize` | `Page<Payment>` | O M (S own) | Planned? |
| GET | `/payments/:id` | | `Payment` | O M (S own) | Planned? |
| POST | `/payments` | `{ shopId, planId?, saleId?, method, amountPaisa, chequeNo?, imageIds }` | `Payment` | O M S | Planned? |
| POST | `/payments/:id/confirm` | | `Payment` | O M | Planned? |
| POST | `/payments/:id/bounce` | | `Payment` | O M | Planned? |

Cash is confirmed at once; cheque (number + at least one photo) and online (at least one screenshot) start `pending`. Confirm/bounce only from `pending`, once. An image can back only one payment (`409`).

## Returns and write-offs

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/returns` | `?shopId&salesmanId&from&to&page&pageSize` | `Page<Return>` | O M (S own) | Planned? |
| POST | `/returns` | `{ shopId, planId?, lines: [{ productId, units, reason, restock }] }` | `Return` | O M S | Planned? |
| GET | `/write-offs` | `?from&to&page&pageSize` | `Page<WriteOff>` | O M | Planned? |
| POST | `/write-offs` | `{ productId, units, reason, note, planId? }` | `WriteOff` | O M | Planned? |

Damaged and expired goods are never restocked; only reason `other` may be. A return lowers the shop's balance.

## Expenses and photos

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/expenses` | `?staffId&type&from&to&page&pageSize` | `Page<Expense>` | O M (S own) | Planned? |
| POST | `/expenses` | `{ staffId?, type, amountPaisa, date, note, billImageId? }` | `Expense` | O M S (own) | Planned? |
| GET | `/visit-photos` | `?planId&shopId&salesmanId&flagged&page&pageSize` | `Page<VisitPhoto>` | O M (S own) | Planned? |
| POST | `/visit-photos` | `{ planId, shopId, imageId, deviceTakenAt?, distanceM? }` | `VisitPhoto` | S | Planned? |
| POST | `/images` | the image file (multipart) | `{ id }` | O M S | Planned? |

The server records the real time of a visit photo. EXIF time, distance and duplicate checks only set `flags` (`old_photo`, `far_from_shop`, `duplicate`) for the manager; they never block the upload.

## Reports

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/reports/dashboard` | `?date` | `DashboardSummary` | O M | **NEW** |
| GET | `/reports/sales-by-day` | `?from&to` | `{ date, totalPaisa, count }[]` | O M | Planned? |
| GET | `/reports/sales-by-salesman` | `?from&to` | `{ salesmanId, totalPaisa, count }[]` | O M | Planned? |
| GET | `/reports/overdue` | | `{ shopId, overduePaisa, oldestDueDate }[]`, oldest first | O M | Planned? |
| GET | `/reports/low-stock` | | `Product[]` | O M | Planned? |

`DashboardSummary { date, salesTodayPaisa, salesTodayCount, collectedTodayPaisa, inClearingPaisa, overduePaisa, overdueShopCount, lowStockCount, plansByStatus, flaggedPhotoCount }`.

## Shop portal (the logged-in shop's own data)

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/shop-portal/summary` | | `ShopSummary { shopName, businessName, balancePaisa, inClearingPaisa, creditLimitPaisa, overduePaisa, oldestOverdueDate? }` | Sh | Planned? |
| GET | `/shop-portal/statement` | `?from&to` | `StatementEntry[]` | Sh | Planned? |
| GET | `/shop-portal/invoices` | `?from&to&page&pageSize` | `Page<Sale>` | Sh | **NEW** |
| GET | `/shop-portal/invoices/:id` | | `Sale` | Sh | **NEW** |
| GET | `/shop-portal/payments` | `?from&to&page&pageSize` | `Page<Payment>` | Sh | **NEW** |
| GET | `/shop-portal/returns` | `?from&to&page&pageSize` | `Page<Return>` | Sh | **NEW** |

A shop only ever sees its own records, and never cost prices.

## Change log

- **Step 1:** first version: every module's calls sketched from the planned screens. Reads are used by the Step 1 home pages (`/business`, `/reports/dashboard`, `/day-plans/today`, `/routes`, `/shops`, `/shop-portal/summary`).
- **Step 2 (staff and settings):**
  - The business and staff calls are now marked Planned, as you confirmed.
  - Added `PATCH /business`, `POST /staff/:id/reset-password`, and `POST /uploads/images` (**NEW**).
  - Business gained the fields your brief lists for settings (email, city, registration number, logo), and Staff gained `lastLoginAt`.
  - **NEW**: `Business.logoUrl`, `Staff.passwordResetAt`, `temporaryPassword` on `POST /staff`, and the filters on `GET /staff`.
