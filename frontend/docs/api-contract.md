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

## Products and categories

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/categories` | | `Category[]` (by name) | O M S | Planned |
| POST | `/categories` | `{ name }` | `Category` | O M | Planned |
| PATCH | `/categories/:id` | `{ name }` | `Category` | O M | Planned |
| DELETE | `/categories/:id` | | 204, or `409 conflict` when a product uses it | O M | Planned |
| GET | `/products` | `?search&categoryId&lowStock&active&page&pageSize` (`active` **NEW**; search matches name or SKU) | `Page<Product>` (no cost price for S) | O M S | Planned |
| GET | `/products/:id` | | `Product` (no cost price for S) | O M S | Planned |
| POST | `/products` | `ProductInput`, with `stockUnits` as opening stock | `Product` | O M | Planned |
| PATCH | `/products/:id` | partial `ProductInput`, without `stockUnits`; `imageId: null` removes the photo | `Product` | O M | Planned |
| POST | `/products/:id/stock-adjust` | `{ deltaUnits }` (a signed whole number, not zero) | `Product` | O M | Planned |

Shapes:
- `Category { id, name, productCount }`. `productCount` (**NEW**) counts active and inactive products and is computed by the server. It drives "delete only if unused".
- `Product { id, name, sku, categoryId, unitName, unitsPerCarton, unitPricePaisa, cartonPricePaisa, costPricePaisa?, stockUnits, lowStockUnits, active, imageId?, imageUrl? }`.
  - **Changed:** `unitsPerCarton` and `cartonPricePaisa` are now `null` for a product not sold by the carton. Both are set, or neither.
  - `imageUrl` (**NEW**) is sent by the server, like `Business.logoUrl`.
- `ProductInput { name, sku, categoryId, unitName, unitPricePaisa, unitsPerCarton, cartonPricePaisa, costPricePaisa, lowStockUnits, active, stockUnits, imageId? }`.

Rules (tested in `rules.ts`; field checks in `schemas.ts`):
- **Prices** are whole paisa, zero or more: unit price, carton price and cost price.
- **Units per carton** is a whole number above zero when set, and then the carton needs a price. Otherwise both are `null`.
- **SKU is unique** in the business, ignoring case and spaces at the ends: `conflict`, "Another product already uses this SKU." It is 1 to 40 characters: letters, numbers, `.`, `_`, `/` or `-`, with no spaces.
- **Category names are unique**, ignoring case. This is an assumption; please confirm. A category is deleted only when no product, active or not, uses it.
- **Products are never deleted.** They are deactivated (`active: false`). Inactive products are not issued or sold, and their history stays.
- **Stock is in base units.** The UI shows the carton equivalent beside it ("2 cartons + 17 cups"). Stock is set on create and then changes only through stock moves: `stock-adjust` now, day plans and returns later. A PATCH must not change it.
- **Stock adjustment** adds a signed whole number. It is refused (`invalid`) if stock would go below zero. **Adjustments are not logged yet;** the UI says so. A later step should add a stock-movement log (who, when, why).
- **Low stock** means `stockUnits <= lowStockUnits`. The dashboard and the low-stock report count active products only.
- **Cost price, and so margin,** is sent only to the owner and managers. Margin = unit price − cost, also shown as a share of the unit price.

## Routes

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/routes` | | `Route[]` | O M S | Planned |
| GET | `/routes/:id` | | `Route` | O M S | Planned |
| POST | `/routes` | `{ name }` | `Route` | O M | Planned |
| PATCH | `/routes/:id` | `{ name }` | `Route` | O M | Planned |
| DELETE | `/routes/:id` | | 204, or `409 conflict` (has shops, or a day plan used it) | O M | Planned |
| PUT | `/routes/:id/clients` | `{ shopIds: Id[] }` in visiting order | `Route` | O M | Planned |

`Route { id, name, shopIds }`. `shopIds` is the visiting order.
- **`PUT` replaces the whole ordered list.**
- A shop sent in the list moves to this route: it leaves its old route, because a shop is on at most one route.
- A shop left out is on no route (`routeId: null`). It is not deleted.
- The list is refused (`invalid`) if a shop appears twice or an id is unknown.
- A route is deleted only when it has no shops and no day plan ever used it. Otherwise it stays for history and can be renamed.

## Shops (clients)

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/clients` | `?search&routeId&overdue&active&page&pageSize` (`routeId=none`: on no route; `active` **NEW**; search matches name, owner, phone or PAN) | `Page<ShopWithBalance>` | O M S | Planned |
| GET | `/clients/:id` | | `ShopWithBalance` | O M S | Planned |
| POST | `/clients` | `ShopInput`, plus optional `loginEmail` and `temporaryPassword` | `ShopWithBalance` | O M (S later) | Planned |
| PATCH | `/clients/:id` | partial `ShopInput`, `active`, `loginEmail`; `temporaryPassword` with `loginEmail` to give a shop its first login; `panImageId: null` removes the photo | `ShopWithBalance` | O M | Planned |
| POST | `/clients/:id/reset-password` | `{ temporaryPassword }` | 204 (`invalid` when the shop has no login) | O M | Planned |
| GET | `/clients/:id/balance` | | `ShopBalance` | O M S | Planned |
| GET | `/clients/:id/statement` | `?from&to` | `StatementEntry[]` (opening balance first, running balance) | O M | Planned |
| GET | `/clients/:id/sales` | `?page&pageSize&from&to` | `Page<Sale>` | O M | Planned (the app uses `GET /sales?shopId=`) |
| GET | `/clients/:id/items-taken` | `?from&to` | `ItemTaken[]` | O M | Planned |
| GET | `/clients/:id/returns` | `?page&pageSize` | `Page<Return>` | O M | Planned (the app uses `GET /returns?shopId=`) |

Payments for one shop come from `GET /payments?shopId=`. That one is not in your list, so please confirm it, or add `/clients/:id/payments`.

**Shapes**
- `ShopInput { name, ownerName, phone, address, routeId (or null), pan, panImageId?, registrationNo, latitude, longitude, creditLimitPaisa, openingBalancePaisa, dueDays }`.
- `Shop` adds `id, active, hasLogin, loginEmail?, passwordResetAt?, createdByRole?, panImageUrl?` (`panImageUrl` is sent by the server).
  - **NEW:** `routeId` may be `null`.
  - **NEW:** `passwordResetAt`, `createdByRole`, `panImageUrl`.
- `ShopWithBalance` adds `balancePaisa, inClearingPaisa, overduePaisa`, computed by the server.
- `ShopBalance { openingPaisa, salesPaisa, paymentsPaisa, returnsPaisa, balancePaisa, inClearingPaisa, overduePaisa, creditLimitPaisa, creditUsedPaisa }`.
  - `balance = opening + sales − payments − returns`.
  - Only confirmed sales and payments count; pending payments are `inClearing`.
  - `creditUsed` is the balance when positive, else 0.
- `ItemTaken { productId, unit: "unit" | "carton", quantity, baseUnits, totalPaisa }`: confirmed sales grouped by product and unit.

**Rules** (tested in `rules.ts`; field checks in `schemas.ts`)
- **PAN** is optional and, when given, exactly 9 digits. It is **unique within the business**: `conflict`, "Another shop already has this PAN."
- **Shop login email** is unique across shops, ignoring case: `conflict`, "Another shop already signs in with this email."
  - An email and a temporary password come together, or neither.
  - Passwords are never returned, stored in plain text or logged.
- **Location** is optional: both latitude and longitude, or neither. Latitude is −90 to 90, longitude −180 to 180. There is no map.
- **Opening balance** can be negative: the shop starts with credit.
- **A shop a salesman adds** starts with credit limit 0 and opening balance 0, whatever is sent; a manager sets them later. It **must** come with a login (email and temporary password): `invalid` otherwise. It is on no route until a manager places it. The app then adds it to the day as an ad-hoc visit if the day is in progress.
- **Shops are never deleted**; they are deactivated. An inactive shop is not visited or sold to, and its login should stop working. The demo's sign-in is separate, so this is not shown.

## Day plans

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/day-plans` | `?from&to&salesmanId&status&page&pageSize` (one day: `from=to`) | `Page<DayPlan>` (newest first) | O M (S own) | Planned |
| GET | `/day-plans/:id` | | `DayPlan` | O M (S own) | Planned |
| GET | `/day-plans/:id/report` | | `DayReport` | O M (S own) | Planned |
| GET | `/day-plans/today` | | `DayPlan \| null` (the salesman's plan in progress, else today's) | S | **NEW** |
| POST | `/day-plans` | `{ date, salesmanId, routeId, lines: [{ productId, unit: "unit" \| "carton", quantity }] }` | `DayPlan` | O M | Planned |
| DELETE | `/day-plans/:id` | | 204 (planned only; stock restored), else `409 conflict` | O M | Planned |
| POST | `/day-plans/:id/start` | | `DayPlan` (today's planned day; one in progress per salesman) | S (own) | Planned |
| GET | `/day-plans/:id/shops` | | `VisitShop[]` (the day's visits in order) | O M S (own) | Planned |
| POST | `/day-plans/:id/visits` | `{ shopId }` | `VisitShop` (ad-hoc visit, added at the end) | S (own) | Planned |
| GET | `/visits/:id` | | `VisitShop` | O M S (own) | **NEW** |
| PATCH | `/visits/:id` | `{ status: "visited" \| "skipped", skipReason? }` | `VisitShop` | S (own) | Planned |
| POST | `/day-plans/:id/close` | `{ reportedUnsold: StockLine[], cashHandedOverPaisa }` | `DayPlan` | S (own) | Planned |
| POST | `/day-plans/:id/reconcile` | `{ counted: StockLine[], cashCountedPaisa, notes }` | `DayPlan` | O M | Planned |

**Shapes**
- `DayPlan { id, date, salesmanId, routeId, status, issued: StockLine[], visits: Visit[], reportedUnsold?, counted?, cashHandedOverPaisa?, cashCountedPaisa?, reconcileNotes?, reconciledBy?, createdAt?, startedAt?, closedAt?, reconciledAt? }`.
  - `StockLine { productId, units }`, always in base units.
  - `visits` is the route's shops in order, copied when the plan is made.
  - **NEW:** `reconcileNotes`, `reconciledBy`, `createdAt`.
  - **Changed:** `POST` takes `lines` with a unit and quantity, and the server works out base units.
- `DayReport` (**NEW** shape for the planned `/report`):
  - `{ plan, stock: DayStockLine[], cash: { collectedPaisa, handedOverPaisa, countedPaisa, differencePaisa }, sales: { count, totalPaisa }, payments: [{ method, count, amountPaisa, pendingCount }], visits: { visited, skipped, pending } }`.
  - `DayStockLine { productId, issued, sold, remaining, reportedUnsold, counted, writtenOff, shortage }`.

- `Visit { id, shopId, status: "pending" | "visited" | "skipped", at?, skipReason?, adHoc? }`. `id` and `adHoc` are **NEW**.
- `VisitShop { visit, planId, planStatus, position, shop: ShopWithBalance, todayPurchasesPaisa, todaySalesCount }` is **NEW**: the shape for `/day-plans/:id/shops` and `/visits/:id`.

**Rules** (tested in `rules.ts`)
- **Lifecycle:** `planned → in_progress → closed → reconciled`, one step at a time, never back.
- **Start:** only the salesman on the plan, only on the plan's own day, and **only one plan in progress per salesman**: `409 conflict`, "Finish the day already in progress first."
- **Actions on shops** (visit, skip, ad-hoc visit, and later sale, payment, return and photo) are refused unless the plan is `in_progress`.
- **Visits:**
  - Only the salesman on the plan may change them.
  - A skip needs a reason (up to 200 characters).
  - A skipped shop can still be visited later; a visited shop stays visited.
- **Ad-hoc visit:** an active shop not already on the day's list. It goes at the end, and the route itself does not change.
- **Close:**
  - Every visit must be visited or skipped.
  - Every product carried must be counted, with whole numbers of zero or more, and no count above what should be left (issued − sold − written off).
  - Cash handed over is whole paisa, zero or more.
- **Making a plan:**
  - It needs an active salesman, a route with shops, and a date of today or later.
  - **One plan per salesman + route + date:** `409 conflict`, "<Name> already has a plan for <route> on that date."
- **Issuing:**
  - Each line is a whole quantity above zero, in pieces or cartons (cartons only where the product has them), for an active product.
  - Lines for the same product are added up, and together they **cannot take more than the warehouse holds** (`invalid`, naming the stock left).
  - Issuing lowers warehouse stock straight away.
- **Delete:** only while planned. All the stock goes back.
- **Reconcile:**
  - Only a closed plan.
  - Every issued product must be counted, with whole numbers of zero or more.
  - No count can be more than could be left: issued − sold (confirmed) − written off on the plan.
  - **The manager's count wins:** shortage = issued − sold − counted − written off. The counted stock goes back to the warehouse.
  - Once reconciled, a plan cannot change.
- **Cash:**
  - Collected = confirmed cash payments on the plan.
  - Difference = counted (or handed over, before reconcile) − collected. Negative is cash missing.
  - Cheque and online payments are reported apart; they don't affect the cash check.

## Idempotency (every create in Steps 7 onwards)

Every `POST` that creates a record carries `idempotencyKey`: a random string of 8 to 100 characters, made once per attempt by the app. It is sent in the body; a header `Idempotency-Key` would do as well, so please choose one.
- **The same key again returns the first result, unchanged,** and creates nothing new. A double tap, or a retry after a dropped connection, makes one record.
- **The same key with a different kind of record** gets `409 conflict`.
- The app also blocks a second tap while a submit is in flight.

## Sales

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/sales` | `?shopId&salesmanId&planId&status&from&to&page&pageSize` | `Page<Sale>` | O M (S own) | Planned |
| GET | `/sales/:id` | | `Sale` (with `paidPaisa`) | O M (S own) | Planned |
| POST | `/sales` | `{ idempotencyKey, visitId, lines: [{ productId, quantity, unit: "unit" \| "carton" }], discountPaisa, cashPaidPaisa, dueDate?, overrideCreditLimit? }` | `Sale` | S (own visit, day in progress); O M with override | Planned |
| POST | `/sales/:id/cancel` | `{ reason }` (required, up to 200 characters) | `Sale` | O M | Planned |

`Sale` adds `visitId`, `subtotalPaisa`, `discountPaisa`, `cashPaidPaisa` and `limitOverrideBy` (**NEW**). `totalPaisa = subtotal − discount`.

Rules (tested):
- **Prices come from the product record on the server, never from the request.**
- **Lines** are whole quantities above zero, in pieces or cartons (cartons only where the product has them), for active products. Added up per product, they **cannot exceed what the salesman still carries** on the plan (issued − sold).
- **Discount:** 0 up to the subtotal.
- **Cash paid now:** 0 up to the total. It is recorded as a confirmed cash payment against the sale.
- **Due date** (only for the credit part): from the sale's day, up to a year later. It defaults to today plus the shop's days to pay.
- **Credit limit:** the check uses only the part on credit (total − cash paid now).
  - Over the limit: `409 conflict`, "This sale takes <shop> over its credit limit by Rs X…" for a salesman.
  - Owner and manager may send `overrideCreditLimit: true`, which records `limitOverrideBy`.
- **Invoice numbers** are sequential per business and never reused.
- **Recording a sale marks the visit visited.**
- **Cancel:**
  - A reason is required. A sale with a confirmed payment against it cannot be cancelled (`409`, "This sale has a confirmed payment. Record a return instead."); a pending cheque does not block it.
  - The invoice keeps its number; `cancelledAt`, `cancelReason` and `cancelledBy` are recorded.
  - The sale stops counting in the shop's balance.
  - **The goods:** while the sale's day plan is still in progress or closed, they count as back with the salesman and are counted at reconcile. Once the day is reconciled (or with no day plan), they go back into warehouse stock.
- `paidPaisa` (**NEW**) is the confirmed payments linked to the sale (`saleId`). The server sends it on list and detail.

## Payments

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/payments` | `?shopId&salesmanId&planId&saleId&method&status&from&to&page&pageSize` (`planId`, `saleId` **NEW**) | `Page<Payment>` | O M (S own) | Planned |
| GET | `/payments/:id` | | `Payment` (with `imageUrls`) | O M (S own) | Planned |
| POST | `/payments` (multipart) | `idempotencyKey, visitId, saleId?, method, amountPaisa`; cheque: `chequeNo, bank, chequeDate`, plus the photo; online: `reference`, plus the screenshot | `Payment` | S (own visit, day in progress) | Planned |
| PATCH | `/payments/:id/status` | `{ status: "confirmed" \| "bounced" }` | `Payment` | O M | Planned |

`Payment` adds `bank`, `chequeDate`, `reference` and `visitId` (**NEW**).
- The app sends images first (`POST /uploads/images`) and then `imageIds` as JSON. Your plan says multipart: if `POST /payments` takes the file itself, the app can switch.
- **Cash** is confirmed at once.
- **A cheque** needs a number, bank, date and at least one photo; **online** needs a reference and at least one screenshot. Both start `pending`, and the app says so: "pending until your manager confirms".
- **Decide:** only from `pending`, once (`409` otherwise). It records `decidedBy` and `decidedAt`.
  - Confirming lowers the shop's balance.
  - Bouncing leaves it as it was, because a pending payment never counted.
- `imageUrls` (**NEW**) holds the images' addresses, in the same order as `imageIds`, sent by the server.
- An image can back only one payment.
- `saleId`, when sent, must be a confirmed sale of the same shop.
- A payment marks the visit visited.

## Returns and write-offs

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/returns` | `?shopId&salesmanId&from&to&page&pageSize` | `Page<Return>` | O M (S own) | Planned |
| GET | `/returns/:id` | | `Return` | O M (S own) | Planned |
| POST | `/returns` | `{ idempotencyKey, visitId \| shopId, lines: [{ productId, units, reason, restock, valuePaisa? }] }` | `Return` | S with `visitId` (own visit, day in progress); O M with `shopId`, and may set `valuePaisa` | Planned |
| GET | `/clients/:id/returnable` | | `{ productId, units }[]`: bought less returned, by anyone | O M S | **NEW** |
| GET | `/write-offs` | `?from&to&page&pageSize` | `Page<WriteOff>` | O M | Planned |
| POST | `/write-offs` | `{ idempotencyKey, productId, unit: "unit" \| "carton", quantity, reason, note, planId? }` | `WriteOff` | O M | Planned |

- **A shop returns at most what it bought** (confirmed sales) **and has not already returned.**
- **Credited value** = units × the product's unit price. Only an owner or manager may send another `valuePaisa`; the salesman screen shows it read-only.
- **Damaged and expired goods are never restocked;** only reason `other` may be.
- Restocked goods go back into warehouse stock.
- A return lowers the shop's balance and marks the visit visited.
- A manager's return (with `shopId`) is recorded with the manager as `salesmanId` (the person who recorded it) and no plan.

**Write-offs** (tested): `WriteOff` adds `unit`, `quantity` and `createdAt` (**NEW**); `units` is the base units.
- A whole quantity above zero, a reason, and a note of up to 300 characters.
- **Without a day plan** it comes out of the warehouse: never more than the warehouse holds, and the warehouse stock goes down.
- **With a day plan** the goods already left the warehouse when they were issued, so **the warehouse is not reduced again**. The plan must be in progress or closed (not planned, not yet reconciled), the product must be on it, and the quantity can't exceed what is left on it (issued − sold − already written off). It counts in that plan's shortage.

## Expenses and photos

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/expenses` | `?staffId&type&from&to&page&pageSize` | `Page<Expense>` | O M (S own) | Planned |
| POST | `/expenses` | `{ idempotencyKey, staffId?, type, amountPaisa, date, note, billImageId? }` | `Expense` | O M S (own) | Planned |
| GET | `/visit-photos` | `?from&to&planId&shopId&salesmanId&flagged&page&pageSize` (dates are the Nepal date of `takenAt`) | `Page<VisitPhoto>` (with `imageUrl`) | O M (S own) | Planned |
| POST | `/visits/:id/photos` | `{ idempotencyKey, imageId, note, deviceTakenAt?, latitude?, longitude? }` | `VisitPhoto` | S (own visit, day in progress) | Planned |
| POST | `/uploads/images` | the image file (multipart) | `{ id, url }` | O M S | **NEW** (see Uploads) |

**Expenses:**
- A salesman adds only their own: `fuel`, `khaja` or `misc`. Salary is added by the owner or a manager.
- The amount is above zero, the date is not in the future, and the note is up to 300 characters.

**Visit photos:**
- The server records the real time.
- **Flags never block the upload:**
  - `old_photo`: the camera's time is more than 15 minutes before the upload.
  - `far_from_shop`: more than 250 m from the shop's saved location, when both locations are known.
  - `duplicate`: the same image as an earlier photo.
  - `no_photo_data` (**NEW**): no camera time came with the picture.
- The app shows any flag neutrally: "The manager will review this photo".
- The photo is taken with the live camera and the Nepal date and time are burned into it.
- A photo marks the visit visited.

## Reports

| Method | Path | Request | Response | Who | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/reports/dashboard` | `?date` | `DashboardSummary` | O M | **NEW** |
| GET | `/reports/today` | | `TodayReport` | S (own); O M (all) | Planned |
| GET | `/reports/salesman/:id/analytics` | `?from&to` | `SalesmanAnalytics` | S (self only); O M | Planned |
| GET | `/reports/sales-by-day` | `?from&to` | `{ date, totalPaisa, count }[]` | O M | Planned? |
| GET | `/reports/sales-by-salesman` | `?from&to` | `{ salesmanId, totalPaisa, count }[]` | O M | Planned? |
| GET | `/reports/overdue` | | `{ shopId, overduePaisa, oldestDueDate }[]`, oldest first | O M | Planned? |
| GET | `/reports/low-stock` | | `Product[]` | O M | Planned? |

**Shapes:**
- `DashboardSummary { date, salesTodayPaisa, salesTodayCount, collectedTodayPaisa, inClearingPaisa, overduePaisa, overdueShopCount, lowStockCount, plansByStatus, flaggedPhotoCount }`.
- `TodayReport { date, count, totalPaisa, cashCollectedPaisa, byShop: [{ shopId, count, totalPaisa, cashPaisa }] }`: confirmed sales today, and confirmed cash payments today.
- `SalesmanAnalytics { from, to, sales: { count, totalPaisa }, payments: [{ method, count, amountPaisa, pendingCount }], perDay: [{ date, count, totalPaisa }], perShop: [{ shopId, count, totalPaisa }], topProducts: [{ productId, baseUnits, totalPaisa }] (top 5), returnsPaisa, expensesPaisa }`.
  - Confirmed sales only; bounced payments are left out.
  - Days with no sales are not sent; the app shows them as empty.

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
- **Step 3 (products and categories):**
  - Category create, rename and delete; `POST /products/:id/stock-adjust`; product `sku` and image. All are marked Planned, as you confirmed.
  - **NEW:** `Category.productCount`, `Product.imageUrl`, and the `active` filter on `GET /products`.
  - **Changed:** `unitsPerCarton` and `cartonPricePaisa` can be `null`. `GET /categories` moved under its own module in `client.ts` (`categories.list`).
  - The low-stock count and report now leave out inactive products.
- **Step 4 (routes and shops):**
  - Routes CRUD and `PUT /routes/:id/clients`.
  - The shop calls are now under `/clients`, with balance, statement, sales, items-taken, returns and reset-password. All are marked Planned, as you listed.
  - **NEW:** `routeId: null` (on no route), the `active` and `routeId=none` filters, `Shop.passwordResetAt`, `createdByRole` and `panImageUrl`.
  - **Changed:** `GET /routes` moved out of the shops module (`routes.list`).
- **Step 5 (day plans and reconcile, manager):**
  - `POST`, `GET` and `DELETE /day-plans`, `GET /day-plans/:id`, `POST /day-plans/:id/reconcile` and `GET /day-plans/:id/report` are marked Planned, as you listed.
  - **NEW:** the `DayReport` shape, `reconcileNotes`, `reconciledBy`, `createdAt`, `notes` on reconcile, and the `planId` filter on `GET /payments`.
  - **Changed:** `POST /day-plans` takes `lines` (unit and quantity) instead of `issued`.
  - Start, visit and close are left to the salesman step.
- **Step 6 (salesman app, part 1):**
  - `POST /day-plans/:id/start`, `GET /day-plans/:id/shops`, `POST /day-plans/:id/visits`, `PATCH /visits/:id`, `POST /day-plans/:id/close`, and shop create by a salesman. All are marked Planned, as you listed.
  - **NEW:** `GET /visits/:id`, the `VisitShop` shape, and `Visit.id` and `adHoc`.
  - **Removed:** `POST /day-plans/:id/visits/:shopId`, replaced by `PATCH /visits/:id`.
- **Step 7 (salesman app, part 2):**
  - `POST /sales`, `POST /payments`, `POST /returns`, `POST /visits/:id/photos`, `GET /sales`, `GET /reports/today`, `GET /reports/salesman/:id/analytics`, `POST /expenses` and `GET /expenses` are marked Planned, as you listed.
  - **NEW:** the idempotency key on every create, the new sale and payment fields, `GET /clients/:id/returnable`, and the `TodayReport` and `SalesmanAnalytics` shapes.
  - **Changed:** creates take `visitId`, and the server derives the shop and plan from it. Cheque payments now need a bank and a date, and online payments a reference.
- **Step 8 (manager: sales, payments, returns, photos):**
  - `GET /sales/:id`, `POST /sales/:id/cancel`, `GET /payments/:id`, `PATCH /payments/:id/status`, `GET /returns/:id`, `POST /returns` (manager), `GET`/`POST /write-offs` and `GET /visit-photos` are marked Planned, as you listed.
  - **Changed:** `PATCH /payments/:id/status` replaces the separate confirm and bounce calls. Write-offs take `unit` and `quantity`.
  - **NEW:** `Sale.paidPaisa` and `cancelledBy`, `Payment.imageUrls`, `VisitPhoto.imageUrl`, the `no_photo_data` flag, and the `saleId` and date filters.
