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
| **Seller 1** | `seller1@demo.test` | `Password123!` | Himalayan Wholesale Distributors (Grains, Dal, Sugar, Salt) |
| **Seller 2** | `seller2@demo.test` | `Password123!` | Everest Beverages & Snacks (Wai Wai, Juices, Coffee, Tea) |
| **Seller 3** | `seller3@demo.test` | `Password123!` | Valley Hardware Supplies (Cement, TMT Steel, LED Lights, Paints) |
| **Buyer Dealer 1** | `buyer1@demo.test` / `dealer1@demo.test` | `Password123!` | Kathmandu Valley Retail Mart |
| **Buyer Dealer 2** | `buyer2@demo.test` / `dealer2@demo.test` | `Password123!` | Pokhara Lakeside Stores |
| **Seller & Buyer** | `both@demo.test` | `Password123!` | Apex Multi-Trade Enterprise (Wholesaler-to-wholesaler trading) |
| **Pending Business** | `pending@demo.test` | `Password123!` | Sunrise General Suppliers (Awaiting Admin KYC approval) |

---

## 3. Architecture Overview

### Backend (NestJS + TypeScript Strict + Drizzle ORM)
- **Monolith Domain Modules:** Auth, Orgs, Catalog, Inventory, Cart, Checkout, Orders, Payments, Shipments, Admin.
- **Multi-Tenancy Scoping:**
  - Tenant queries strictly require active `orgId` resolved from the `X-Org-Id` header via global `OrgContextGuard`.
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

---

## 4. API Route List (`/api/v1`)

### Authentication & Tenant
- `POST /api/v1/auth/register` - Register user and new pending business
- `POST /api/v1/auth/login` - Login with email and password
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

## 5. What is Mocked or Stubbed

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

## 6. Assumptions & Engineering Decisions

1. **Self-Purchasing Restriction:** An organization is blocked at both cart addition and checkout from purchasing its own products.
2. **Platform Admin Tenancy:** Platform admins belonging to `PLATFORM` organization are granted administrative permissions without requiring an `X-Org-Id` header for platform routes.
3. **Order State Machine:** Transitions strictly adhere to the documented lifecycle:
   ```
   PAYMENT_PENDING -> PAID | PAYMENT_FAILED | CANCELLED
   PAID -> CONFIRMED | REJECTED_REFUND_PENDING
   REJECTED_REFUND_PENDING -> REFUNDED
   CONFIRMED -> READY_FOR_PICKUP
   READY_FOR_PICKUP -> IN_DELIVERY
   IN_DELIVERY -> DELIVERED
   ```
   Any forbidden transition triggers an HTTP 409 Conflict error.
