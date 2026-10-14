# Bitaran - Wholesale Marketplace Platform Prototype

**Bitaran** is a real, runnable full-stack prototype of a B2B wholesale marketplace built with **NestJS**, **Drizzle ORM**, **PostgreSQL**, **React**, **Vite**, and **Tailwind CSS**.

The platform demonstrates the end-to-end core flow:
1. **Business registers** as a buyer, seller, or both.
2. **Platform administrator reviews and approves** the business account.
3. **Approved seller lists wholesale products**, variants, pack sizes, MOQ, and stock.
4. **Buyer purchases across multiple independent sellers in one single checkout**.
5. **Checkout atomically splits into one independent order per seller** and atomically reserves inventory.
6. **Buyer pays online** via simulated payment provider (mock eSewa / Khalti).
7. **Seller reviews and accepts/rejects** incoming paid orders.
8. **Platform handles delivery logistics** and updates shipments, synchronizing order statuses in real-time.

---

## 1. Quick Start & Setup

### Prerequisites
- Node.js >= 20 (Tested on Node.js v26)
- PostgreSQL running locally on `localhost:5432`

### Backend Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Verify or create `backend/.env` with your PostgreSQL database credentials:
   ```env
   DATABASE_URL=postgresql://postgres:1234@localhost:5432/Bitaran
   TEST_DATABASE_URL=postgresql://postgres:1234@localhost:5432/bitaran_test
   JWT_ACCESS_SECRET=change_me_access_secret_32chars_min
   JWT_REFRESH_SECRET=change_me_refresh_secret_32chars_min
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   PORT=3000
   NODE_ENV=development
   ```

3. Install dependencies, generate migrations, migrate, and seed the database:
   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Start the backend API development server:
   ```bash
   npm run dev
   ```
   The API will be live at `http://localhost:3000/api/v1`.

5. Run test suite:
   ```bash
   npm test
   ```

### Frontend Setup

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the web app development server:
   ```bash
   npm run dev
   ```
   The web application will be accessible at `http://localhost:5173`.

4. Run frontend tests:
   ```bash
   npm test
   ```

---

## 2. Demo Accounts

All seeded demo accounts use the standard password: `Password123!`
*(You can also use the 1-click demo buttons on `/login` and `/platform/login` to auto-fill credentials instantly!)*

| Role / Type | Email | Password | Business Name / Description |
|---|---|---|---|
| **Super Admin** | `superadmin@demo.test` | `Password123!` | Platform Super Administrator |
| **Admin** | `admin@demo.test` | `Password123!` | Platform Staff Administrator |
| **Seller 1** | `seller1@demo.test` | `Password123!` | Himalayan Wholesale Distributors (Owner: Grains, Dal, Sugar, Salt) |
| **Seller 1 Manager** | `manager1@demo.test` | `Password123!` | Himalayan Wholesale Distributors (Manager: Operations Admin) |
| **Seller 1 Staff** | `staff1@demo.test` | `Password123!` | Himalayan Wholesale Distributors (Staff: Warehouse & Catalog) |
| **Seller 2** | `seller2@demo.test` | `Password123!` | Everest Beverages & Snacks (Wai Wai, Juices, Coffee, Tea) |
| **Seller 3** | `seller3@demo.test` | `Password123!` | Valley Hardware Supplies (Cement, TMT Steel, LED Lights, Paints) |
| **Buyer Dealer 1** | `buyer1@demo.test` / `dealer1@demo.test` | `Password123!` | Kathmandu Valley Retail Mart |
| **Buyer Dealer 2** | `buyer2@demo.test` / `dealer2@demo.test` | `Password123!` | Pokhara Lakeside Stores |
| **Seller & Buyer** | `both@demo.test` | `Password123!` | Apex Multi-Trade Enterprise (Wholesaler-to-wholesaler trading) |
| **Pending Business** | `pending@demo.test` | `Password123!` | Sunrise General Suppliers (Awaiting Admin KYC approval) |
| **Field Seller 1** | `field1` (username) | `Password123!` | Himalayan Wholesale Distributors (Field Rep: Ramesh Shrestha) |
| **Field Seller 2** | `field2` (username) | `Password123!` | Himalayan Wholesale Distributors (Field Rep: Sita Gurung) |

---

## 3. Architecture Overview

### Backend (NestJS + TypeScript Strict + Drizzle ORM)
- **Monolith Domain Modules:** Auth, Orgs, Catalog, Inventory, Cart, Checkout, Orders, Payments, Shipments, Admin, Field.
- **Multi-Tenancy Scoping:**
  - Tenant queries strictly require active `orgId` resolved from the `X-Org-Id` header via global `OrgContextGuard`.
  - For `FIELD_SELLER` users, `OrgContextGuard` automatically uses their single organization membership and ignores any `X-Org-Id` header.
  - Platform administrators automatically resolve platform privileges even without `X-Org-Id`.
- **Atomic Stock Reservation:**
  - Stock reservations use single conditional updates within `db.transaction(...)`:
    ```sql
    UPDATE inventory_items
    SET qty_reserved = qty_reserved + $n
    WHERE variant_id = $id AND (qty_on_hand - qty_reserved) >= $n
    RETURNING id;
    ```
  - If any item in the checkout fails stock availability, the whole transaction rolls back atomically.
- **Idempotent Payment Postbacks:**
  - Mock payments enforce unique transaction verification through database transactions and unique gateway reference indices.
- **Scheduled Expiry Service:**
  - Orders lingering in `PAYMENT_PENDING` for more than 15 minutes are automatically expired and reserved inventory is released back to stock.
- **Precision Monetary Math:**
  - All monetary values are integer **paisa** in database and API. Totals use PostgreSQL `bigint` with a global interceptor ensuring BigInt serialization to string.

### Frontend (React + Vite + TanStack Query + Tailwind CSS)
- **Shared App Constant:** `APP_NAME = 'Bitaran'` imported across all navigation, page titles, logos, and notifications.
- **Safe Currency Display:** `formatMoney(paisa)` formats integer paisa into readable `Rs 1,200.00` representations with zero floating point inaccuracy.
- **Role-Adaptive Layout:** Real-time role and multi-business switcher updating `X-Org-Id` header dynamically on API calls.
- **Field Seller Mobile Web App:** Dedicated mobile-first layout (`/field/*`) with sticky header, 48px touch targets, quick variant search, quantity stepper, payment buttons, and bottom tab bar.

---

## 4. API Route List (`/api/v1`)

### Authentication & Tenant
- `POST /api/v1/auth/register` - Register user and new pending business
- `POST /api/v1/auth/login` - Login with email and password (rejects FIELD_SELLER)
- `POST /api/v1/auth/field/login` - Login with username and password (field sellers only)
- `POST /api/v1/auth/password` - Change own password (field sellers and users with `must_change_password`)
- `POST /api/v1/auth/refresh` - Rotate refresh token
- `POST /api/v1/auth/logout` - Revoke refresh tokens
- `GET  /api/v1/orgs/my` - List active user memberships

### Addresses
- `GET  /api/v1/orgs/addresses` - List addresses for active org
- `POST /api/v1/orgs/addresses` - Create a new address
- `DELETE /api/v1/orgs/addresses/:id` - Delete an address

### Catalog & Browse
- `GET  /api/v1/catalog/products` - Public catalog browse with filters
- `GET  /api/v1/catalog/products/:id` - Product details with variants
- `GET  /api/v1/catalog/products/seller` - Seller's own products list
- `POST /api/v1/catalog/products` - Create product and variants (Seller)
- `PUT  /api/v1/catalog/products/:id` - Update product and variants (Seller)
- `GET  /api/v1/catalog/categories` - List categories

### Field Sellers (Field Sales Team)
- `GET  /api/v1/field/me/summary` - Today and all-time revenue and sales counts (Asia/Kathmandu)
- `GET  /api/v1/field/products` - Active catalog variants and snapshotted prices for the employer
- `POST /api/v1/field/sales` - Record a new field sale (catalog-computed server pricing)
- `GET  /api/v1/field/sales` - Paginated own sales history (newest first)

### Team Management (Milestone 9)
- `GET   /api/v1/seller/team` - List all members with role, status, creator, and join date (`team.manage`)
- `POST  /api/v1/seller/team` - Create a new team member (Owner creates Manager/Staff; Manager creates Staff; returns temporary password once)
- `POST  /api/v1/seller/team/:userId/disable` - Disable member and revoke active refresh tokens (hierarchy-enforced)
- `POST  /api/v1/seller/team/:userId/enable` - Re-enable member account (hierarchy-enforced)
- `POST  /api/v1/seller/team/:userId/reset-password` - Reset temporary password (returns once; hierarchy-enforced)
- `PATCH /api/v1/seller/team/:userId/role` - Promote or demote member between MANAGER and STAFF (Owner only)

### Activity Audit Log (Milestone 9)
- `GET   /api/v1/seller/activity` - Filterable seller activity log (price changes, stock adjustments, order transitions, team changes, field sellers; Owner only: `audit.view`)

### Owner Field Seller Management & Analytics
- `POST /api/v1/seller/field-sellers` - Create field seller account (returns temporary password once)
- `GET  /api/v1/seller/field-sellers` - List field sellers with today, month, and all-time totals
- `GET  /api/v1/seller/field-sellers/:id` - Get field seller detail with 14-day revenue breakdown
- `PATCH /api/v1/seller/field-sellers/:id` - Update field seller display name and phone
- `POST /api/v1/seller/field-sellers/:id/disable` - Disable seller and revoke refresh tokens
- `POST /api/v1/seller/field-sellers/:id/enable` - Re-enable field seller account
- `POST /api/v1/seller/field-sellers/:id/reset-password` - Reset temporary password (returns once)
- `GET  /api/v1/seller/field-sales` - Filterable seller sales history
- `POST /api/v1/seller/field-sales/:id/void` - Void sale with mandatory audit reason (3-200 chars)
- `GET  /api/v1/seller/field-analytics` - Aggregated analytics (totals, leaderboard, day trend, top 10 products, payment method split)

### Inventory
- `GET  /api/v1/inventory/stock` - List inventory items for active seller
- `POST /api/v1/inventory/stock/:variantId/adjust` - Adjust stock quantity (RECEIPT/ADJUSTMENT)

### Cart & Checkout
- `GET    /api/v1/cart` - View cart grouped by seller
- `POST   /api/v1/cart/items` - Add or update cart item
- `DELETE /api/v1/cart/items/:variantId` - Remove cart item
- `POST   /api/v1/checkout` - Create checkout, reserve stock, split per-seller orders

### Orders
- `GET  /api/v1/orders/buyer` - Buyer order history
- `GET  /api/v1/orders/seller` - Seller incoming orders
- `GET  /api/v1/orders/:id` - Order details with status history and shipment info
- `POST /api/v1/orders/:id/transition` - State machine transition (`CONFIRMED`, `READY_FOR_PICKUP`, `REJECTED_REFUND_PENDING`, `REFUNDED`)

### Payments
- `GET  /api/v1/payments/:id` - Get payment session details
- `POST /api/v1/payments/:id/mock-callback` - Mock gateway callback with server-side verify
- `POST /api/v1/payments/callback` - Generic callback endpoint

### Shipments & Logistics
- `GET  /api/v1/shipments` - List all shipments (Admin)
- `GET  /api/v1/shipments/:id` - Shipment details
- `POST /api/v1/shipments/orders/:orderId` - Create shipment for order
- `PUT  /api/v1/shipments/:id` - Update shipment status and sync order status

### Platform Administration
- `GET  /api/v1/admin/dashboard` - Platform statistics
- `GET  /api/v1/admin/orgs` - List businesses by status (PENDING/APPROVED/SUSPENDED)
- `PUT  /api/v1/admin/orgs/:id/status` - Approve, reject, or suspend business
- `GET  /api/v1/admin/categories` - Categories list
- `POST /api/v1/admin/categories` - Create category
- `PUT  /api/v1/admin/categories/:id` - Update category
- `DELETE /api/v1/admin/categories/:id` - Delete category
- `GET  /api/v1/admin/orders` - Platform-wide order ledger

---

## 5. Roles, Permissions & Team Hierarchy (Milestone 9)

### Role Hierarchy
Within a seller business organization, members belong to a strict hierarchy:
$$\text{OWNER (Rank 3)} > \text{MANAGER (Rank 2)} > \text{STAFF (Rank 1)}$$

- **Field Sellers (`FIELD_SELLER`)** are independent mobile sales representatives outside this operational ladder.
- **Platform Admins (`SUPER_ADMIN` / `ADMIN`)** administer platform-level approvals and logistics.

### Hierarchy Enforcement Rules (`canManage`)
1. **Strict Superiority:** A user can only create, disable, enable, or reset passwords for members ranked **strictly below** their own role (`actorRank > targetRank`).
   - `OWNER` can manage `MANAGER` and `STAFF`.
   - `MANAGER` can only manage `STAFF`.
   - `STAFF` cannot manage any team members.
2. **Owner Inviolability:** Nobody can disable, demote, or reset passwords for an `OWNER`. No API creates a second `OWNER` (ownership is tied to the business registrant).
3. **Self-Action Forbidden:** A user cannot disable themselves or modify their own role.
4. **Owner-Only Role Changes:** Only an `OWNER` can promote or demote members between `MANAGER` and `STAFF`.
5. **Immediate Invalidation:** Disabling a member immediately revokes their active refresh tokens. Any subsequent request with that organization context is blocked by `OrgContextGuard` with HTTP 403 and error code `MEMBERSHIP_DISABLED`.

### Permissions Matrix

| Permission | Description | OWNER | MANAGER | STAFF | FIELD_SELLER |
|---|---|:---:|:---:|:---:|:---:|
| `team.manage` | View team, create lower-ranked members, disable/enable, reset PW | Yes | Yes | No | No |
| `team.role_change` | Promote / demote members between Manager and Staff | Yes | No | No | No |
| `audit.view` | View full organization activity audit log | Yes | No | No | No |
| `product.create` | Create new products and variants | Yes | Yes | No | No |
| `product.edit` | Update product info, prices, and variant details | Yes | Yes | No | No |
| `stock.adjust` | Adjust warehouse inventory levels | Yes | Yes | Yes | No |
| `order.view` | View incoming customer and dealer orders | Yes | Yes | Yes | No |
| `order.accept` | Confirm orders (`CONFIRMED`, `READY_FOR_PICKUP`) | Yes | Yes | Yes | No |
| `order.reject` | Reject order with refund pending | Yes | Yes | Yes | No |
| `order.mark_refunded`| Complete customer refund (`REFUNDED`) | Yes | No | No | No |
| `fieldseller.manage` | Create, disable, and reset field sellers | Yes | Yes | No | No |
| `fieldsale.view_all` | View sales recorded across all field reps | Yes | Yes | No | No |
| `fieldsale.void` | Void a field sale with mandatory audit reason | Yes | No | No | No |
| `fieldanalytics.view`| View field seller analytics and leaderboard | Yes | Yes | No | No |
| `report.view` | View seller analytics dashboard | Yes | Yes | No | No |
| `payment_creds.manage`| Manage bank details, payment credentials | Yes | No | No | No |
| `checkout.place` | Place marketplace orders (buyer role only) | No | No | No | No |
| `fieldsale.create` | Record new retail field sales on mobile | No | No | No | Yes |
| `fieldsale.view_own` | View own field sale history on mobile | No | No | No | Yes |

---

## 6. Temporary Password Behavior

When an owner or manager creates a new team member or field seller account, or resets an existing account password:
1. The server generates a random 12-character temporary password meeting complexity requirements (uppercase, lowercase, digits, symbols).
2. The password is hashed using `bcrypt` (12 salt rounds) and saved to the database.
3. `must_change_password = true` is set on the user record.
4. The temporary password is returned **strictly once** in the API JSON response (`temporaryPassword`).
5. The temporary password is **never logged** in console logs or database audit records.
6. Until the user changes their password via `POST /api/v1/auth/password`, `JwtAuthGuard` blocks all other endpoints with an HTTP 403 / redirect to the change password screen (`/change-password` or `/field/password`).

---

## 7. Field sellers: not included

The following capabilities are deliberately omitted from this version:
1. **Stock Deductions:** Field sales in v1 have no stock reservation or inventory decrement effects.
2. **Cash Handover & Reconciliation:** Daily cash settlements between field sellers and the business owner are out of scope.
3. **Offline Mode:** The mobile web app requires an active internet connection.
4. **Customer Accounts / Buyer Businesses:** Field sales are direct walk-in/phone retail transactions, not marketplace orders between platform-registered businesses.
5. **Commissions & Incentives:** Calculation of seller commissions, bonuses, or payout ledgering is not included.

---

## 8. Manager role: not included

The following capabilities are deliberately omitted from the Manager role implementation:
1. **Custom per-person permissions:** Permissions are tied directly to the fixed roles (`OWNER`, `MANAGER`, `STAFF`). Granular per-user permission customization is out of scope.
2. **Approval workflows:** Managers do not require owner sign-off for day-to-day operations (products, stock, order acceptance, field sellers).
3. **Ownership transfer or multi-owner businesses:** Exactly one owner exists per business (the user who registered the business). Ownership cannot be transferred or shared.
4. **Email / SMS invitations:** Accounts are created directly by superiors with a temporary password shown once.
5. **Two-factor authentication (2FA):** Multi-factor authentication is out of scope.
6. **Activity log CSV export:** The activity log is viewed interactively via the UI; file export is not included.
7. **Password reset via email link:** Passwords must be reset by a higher-ranked team member or owner.

---

## 9. What is Mocked or Stubbed

As specified in the prototype requirements, the following components are simulated or stubbed for client demonstration:

1. **Payment Gateways (eSewa & Khalti):**
   - Both gateways use `MockProvider` (`backend/src/modules/payments/providers/mock.provider.ts`).
   - `esewa.provider.ts` and `khalti.provider.ts` exist as documented stubs with detailed TODOs outlining live gateway integration specs.
   - The user is redirected to a simulated `/payment/mock/:paymentId` page with Pay and Fail triggers. The server verifies transaction signatures before finalizing order state.
2. **Delivery Logistics:**
   - Platform courier tracking and riders are simulated; shipment status updates are managed manually via `/admin/shipments`. Delivery fee is configured as a flat `Rs 0.00`.
3. **Monthly Seller Subscription Billing:**
   - Flat monthly fee and plans tables exist in the schema, but billing invoices and gateway debits are out of scope.
4. **Document Uploads:**
   - Business document files store file name references without requiring AWS S3 or disk storage.

---

## 10. Assumptions & Engineering Decisions

1. **Self-Purchasing Restriction:** An organization is blocked at both cart addition and checkout from purchasing its own products.
2. **Platform Admin Tenancy:** Platform admins belonging to `PLATFORM` organization are granted administrative permissions without requiring an `X-Org-Id` header for platform routes.
3. **Field Seller Tenancy & Route Isolation:**
   - Field sellers have exactly one membership. `OrgContextGuard` ignores any `X-Org-Id` header and automatically resolves this single membership.
   - Field sellers are strictly forbidden from accessing buyer, seller, and platform admin routes (`403 Forbidden`).
4. **Catalog Price Calculation:**
   - Prices and line totals are strictly calculated by the server using snapshotted variant catalog prices. Any client-submitted prices or totals are ignored.
5. **Server-Enforced Timestamps & Timezones:**
   - `sold_at` is generated solely by the server (`defaultNow()`). Client timestamps are rejected.
   - Today and monthly aggregations use PostgreSQL `AT TIME ZONE 'Asia/Kathmandu'`.
6. **Sales Immutability & Voiding:**
   - Field sales are immutable (no updates or deletes). Owners can void sales with a mandatory reason (3-200 characters). Voided sales remain visible in audit logs but are completely excluded from totals, leaderboard, and analytics aggregations.
7. **Order State Machine:** Transitions strictly adhere to the documented lifecycle:
   ```
   PAYMENT_PENDING -> PAID | PAYMENT_FAILED | CANCELLED
   PAID -> CONFIRMED | REJECTED_REFUND_PENDING
   REJECTED_REFUND_PENDING -> REFUNDED
   CONFIRMED -> READY_FOR_PICKUP
   READY_FOR_PICKUP -> IN_DELIVERY
   IN_DELIVERY -> DELIVERED
   ```
   Any forbidden transition triggers an HTTP 409 Conflict error.
