# Bitaran - Prototype Demonstration Script

This numbered walkthrough guides a reviewer or client step-by-step through the core flow of the Bitaran wholesale marketplace platform:
**Register business -> Admin approves -> Seller lists product -> Buyer checks out from two sellers -> Pays online (mock) -> Seller accepts -> Admin ships & delivers.**

---

### Step 1: Start the Platform

1. **Start Backend API:**
   ```bash
   cd backend
   npm run dev
   ```
   Confirm backend is running on `http://localhost:3000`.

2. **Start Frontend Web App:**
   ```bash
   cd frontend
   npm run dev
   ```
   Open your browser to `http://localhost:5173`.

---

### Step 2: Register a New Business Account

1. In the browser, navigate to `http://localhost:5173/register`.
2. Fill in the form:
   - **Your full name:** Hari Sharma
   - **Phone number:** 9841999888
   - **Email:** `hari@demo.test`
   - **Password:** `Password123!`
   - **Business name:** Pokhara Fresh Foods Pvt Ltd
   - **PAN number:** 500000001
   - Check **"Sell products (Wholesaler)"** and **"Buy products (Dealer)"**.
   - Attach any sample document (e.g. `pan_certificate.pdf`).
3. Click **"Submit for approval"**.
4. Notice that the business dashboard opens with a yellow banner: **"Review Pending: Platform admins review new accounts before products or orders can be activated."**

---

### Step 3: Platform Admin Approves the New Business

1. Log out or open an Incognito window at `http://localhost:5173/platform/login`.
2. Sign in as platform staff:
   - **Email:** `admin@demo.test`
   - **Password:** `Password123!`
3. Navigate to **Approvals** (`/admin/approvals`) in the left sidebar.
4. Locate **"Pokhara Fresh Foods Pvt Ltd"** (PAN: 500000001).
5. Click **"View documents"** to inspect attached certificates.
6. Click the green **"Approve"** button. The business account is now fully approved!
7. Sign out of admin.

---

### Step 4: Seller Lists a Wholesale Product

1. Log in at `http://localhost:5173/login` with an approved seller:
   - **Email:** `seller1@demo.test` (Himalayan Wholesale Distributors)
   - **Password:** `Password123!`
2. In the sidebar, click **Products** (`/seller/products`).
3. Click the black **"Add product"** button.
4. Fill in:
   - **Product Name:** Himalayan Pink Rock Salt 25kg
   - **Category:** Edible Oils & Spices
   - **Description:** Mineral-rich crushed Himalayan pink rock salt for wholesale commercial bakeries and food manufacturing.
   - **Listing Status:** Active
   - **Variants Table:**
     - SKU: `HWD-PINK-25KG`
     - Unit: `bag`
     - Pack size: `1`
     - Price (Rs): `1200`
     - Min Order (MOQ): `5`
5. Click **"Save product"**.
6. The product is immediately created and active in the catalog!

---

### Step 5: Buyer Adds Products from Two Different Sellers to Cart

1. Sign out of seller and log in as a retail dealer (or click the **"Buyer 1 (Kathmandu Mart)"** demo button):
   - **Email:** `buyer1@demo.test` or `dealer1@demo.test` (Kathmandu Valley Retail Mart)
   - **Password:** `Password123!`
2. In the sidebar, click **Browse** (`/browse`).
3. **Add item from Seller 1 (Himalayan Wholesale Distributors):**
   - Locate **"Basmati Rice Premium 25kg"** (Rs 2,800.00 / bag).
   - Click **"Add to cart"**.
4. **Add item from Seller 2 (Everest Beverages & Snacks):**
   - Locate **"Wai Wai Instant Noodles Box (30 Packs)"** (Rs 720.00 / carton).
   - Click **"Add to cart"**.
5. Notice the top bar now displays **Cart (2)**.

---

### Step 6: Multi-Seller Checkout & Stock Reservation

1. Click on **Cart** in the top bar or sidebar (`/cart`).
2. Review the Cart layout:
   - Notice the items are cleanly grouped into **two separate seller cards**:
     1. Himalayan Wholesale Distributors
     2. Everest Beverages & Snacks
3. On the right panel:
   - Delivery Address is automatically pre-selected (`Retail Store Baneshwor`).
   - Select payment provider: **eSewa** or **Khalti**.
   - Note the breakdown shows Rs 0.00 platform delivery fee.
4. Click **"Pay and place orders"**.
5. Stock is atomically reserved, the checkout splits into two distinct orders, and you are automatically redirected to the mock payment gateway!

---

### Step 7: Complete Online Payment (Mocked)

1. You are on the Mock Gateway sandbox (`/payment/mock/:paymentId`).
2. Review the payable total and merchant reference.
3. Click the green **"Pay"** button.
4. The server validates transaction idempotency, verifies the gateway callback, transitions both orders from `PAYMENT_PENDING` to `PAID`, and redirects you to the confirmed Order Detail page!

---

### Step 8: Seller Accepts the Paid Order

1. Sign out and sign in as Seller 1:
   - **Email:** `seller1@demo.test`
   - **Password:** `Password123!`
2. In the sidebar, click **Incoming orders** (`/seller/orders`).
3. Find the newly paid order from `Kathmandu Valley Retail Mart` with status pill **"Paid"**.
4. Click **"Accept"** (or open **View** and click **"Accept order"**).
5. The order status advances to **"Confirmed"**.
6. Click **"Mark Ready for Pickup"**.
7. The order status changes to **"Ready for pickup"**, which automatically generates a shipment in the platform logistics dispatch queue!

---

### Step 9: Platform Admin Dispatches and Delivers Shipment

1. Sign out and sign in as Platform Staff:
   - Go to `http://localhost:5173/platform/login`
   - **Email:** `admin@demo.test`
   - **Password:** `Password123!`
2. In the sidebar, click **Shipments** (`/admin/shipments`).
3. Locate the shipment for the newly prepared order:
   - Notice the Pickup location (Seller warehouse) and Drop location (Buyer store).
   - Courier input: `Kathmandu Valley Express`
4. Change status dropdown from **"Pickup pending"** to **"In transit"** and click **"Update"**.
   - *Synchronized Order Status:* The order status automatically updates to **"In delivery"** and stock is moved from reserved to fulfilled!
5. When delivery arrives, change status dropdown to **"Delivered"** and click **"Update"**.
   - *Synchronized Order Status:* The order status automatically marks as **"Delivered"**!

---

### Step 10: Verify the Completed Order

1. Log in back as the buyer:
   - **Email:** `dealer1@demo.test`
   - **Password:** `Password123!`
2. Navigate to **My orders** (`/orders`).
3. Open the order.
4. Notice all timeline steps (Payment pending &rarr; Paid &rarr; Confirmed &rarr; Ready for pickup &rarr; In delivery &rarr; Delivered) are completely filled in green, with logistics tracking information displayed!

---

### Step 11: Owner Creates and Manages Field Sellers (Milestone 8)

1. Log in as wholesale business owner:
   - **Email:** `seller1@demo.test` (Himalayan Wholesale Distributors)
   - **Password:** `Password123!`
2. In the sidebar, navigate to **Field sellers** (`/seller/field-sellers`).
3. Review the existing seeded team:
   - **Ramesh Shrestha** (`@field1`, password `Password123!`)
   - **Sita Gurung** (`@field2`, password `Password123!`)
   - Notice the live performance numbers for Today, This Month, and To Date.
4. Click the green **"Add field seller"** button (`/seller/field-sellers/new`).
5. Fill in the new representative's details:
   - **Full Name:** Bikash Thapa
   - **Username:** `bikash.sales`
   - **Phone Number:** `9812345678`
6. Click **"Create Field Seller"**.
7. **Notice the Temporary Password Box:**
   - The generated 12-character temporary password is displayed in a highlighted golden box.
   - Click the **"Copy password"** button to copy it.
   - Notice the warning: *"Share this password securely with the seller. They will be required to change it on first login. It will not be shown again."*

---

### Step 12: Field Seller First Login & Forced Password Change

1. Open a mobile browser view or private window and go to the Field Seller login screen:
   `http://localhost:5173/field/login`
2. Attempt login with your newly created seller credentials (or reset password credentials):
   - **Username:** `bikash.sales` (or test account `@field1` with a newly reset password)
   - **Password:** *[Pasted temporary password]*
3. Click **"Sign In"**.
4. **Forced Password Change:**
   - Because `mustChangePassword` is active, the app automatically blocks access to home and redirects to `/field/password`.
   - Any attempt to navigate away is intercepted.
5. Enter:
   - **Current Password:** *[Pasted temporary password]*
   - **New Password:** `MySecretPassword123!`
   - **Confirm New Password:** `MySecretPassword123!`
6. Click **"Save and Continue"**.
7. You are immediately redirected to the mobile **Field Home** (`/field/home`)!

---

### Step 13: Field Seller Records a Sale on Mobile

1. On the mobile screen, sign in as seeded seller `@field1`:
   - URL: `http://localhost:5173/field/login`
   - **Username:** `field1`
   - **Password:** `Password123!`
2. Notice the clean mobile dashboard:
   - **Sold Today** summary card (e.g. Rs 0.00 / 0 sales).
   - **Sold to Date** card.
   - Large green 48px touch-target button: **"Record new sale"**.
3. Tap **"Record new sale"** (or use the bottom tab **New sale** &rarr; `/field/sales/new`):
4. **Select Products:**
   - Use the search bar to filter variants: type `"Rice"` or `"Salt"`.
   - Tap **"Basmati Rice Premium 25kg"** (Rs 2,800.00 / bag). Tap the `+` button to set quantity to `2`.
   - Tap **"Himalayan Pink Rock Salt 25kg"** (Rs 1,200.00 / bag). Set quantity to `1`.
   - Notice the floating bottom cart bar updates instantly to **3 items • Rs 6,800.00**.
5. **Customer & Payment Info:**
   - Customer Name: `Sunil Shrestha`
   - Customer Phone: `9841112233`
   - Select Payment Method: Tap the large **"eSewa"** payment button.
   - Note: `Cash received at counter`.
6. Tap the large green **"Review and Save Sale"** button.
7. Confirm details in the review modal and tap **"Confirm & Record Sale"**.
8. **Success Screen:**
   - Server computes total (`Rs 6,800.00`) and records immutable snapshots.
   - Sale confirmed screen appears with invoice reference.
   - Tap **"View My Sales"**.

---

### Step 14: Field Seller Views Live History

1. In the bottom navigation bar, tap **"My sales"** (`/field/sales`).
2. Notice:
   - Sales are cleanly grouped by date.
   - The newly recorded sale to `Sunil Shrestha` is displayed at the top with badge `Active`, payment badge `eSewa`, and total `Rs 6,800.00`.
   - Tap the card to expand and review all snapshotted line items and SKUs.
3. Tap **"Home"** tab (`/field/home`):
   - Notice **"Sold today"** and **"Sold to date"** counters have updated immediately in real time!

---

### Step 15: Owner Inspects Seller, Voids a Sale, and Views Analytics

1. Switch back to the business owner account at `http://localhost:5173/login`:
   - **Email:** `seller1@demo.test`
   - **Password:** `Password123!`
2. In the sidebar, click **Field sellers** (`/seller/field-sellers`):
   - Notice Ramesh Shrestha (`@field1`) now has updated today and all-time revenue numbers.
3. Click **"View"** next to Ramesh (`/seller/field-sellers/:id`):
   - **Overview Tab:** Review the 14-day sales trend bar chart in Recharts.
   - **Sales Tab:** Review all sales recorded by Ramesh. Click on the Rs 6,800.00 sale to open its detail drawer.
   - **Void Action:** Click the red **"Void"** button.
   - Enter mandatory reason (min 3 chars): `"Customer cancelled order at doorstep"`.
   - Click **"Confirm Void"**.
   - Notice the sale total is struck through with badge `Voided`. The revenue is instantly deducted from all active totals!
   - **Account Tab:** Test clicking **"Reset PW"** to generate a new temporary password, or click **"Disable Account"** to test revoking active sessions.
4. In the sidebar, click **Field analytics** (`/seller/field-analytics`):
   - **Date Range Presets:** Toggle between **Last 7 days**, **Last 30 days**, **This month**, or **Custom**.
   - **Filter by Seller:** Pick **All Field Sellers** or select **Ramesh Shrestha**.
   - **Totals Tiles:** Total revenue, sales count, physical units sold, and average sale value.
   - **Revenue by Day Chart:** Full Recharts bar chart showing daily revenue trends.
   - **Seller Leaderboard:** Ranks field representatives by total revenue and sales count.
   - **Payment Methods Split:** Distribution between Cash, eSewa, Khalti, and Other with percentage progress bars.
   - **Top 10 Products:** Highest moving catalog items by units sold.

---

### Step 16: Manager Role, Team Hierarchy, Permissions & Activity Log (Milestone 9)

#### 1. Owner Manages Team and Creates a Manager
1. Log in as wholesale business owner:
   - **Email:** `seller1@demo.test` (Himalayan Wholesale Distributors)
   - **Password:** `Password123!`
2. In the sidebar, click **Team** (`/seller/team`).
3. Notice the team member table displaying:
   - **Seller One** (`seller1@demo.test`) with pill `OWNER` and status badge `Active`.
   - Seeded **Manager One** (`manager1@demo.test`) with pill `MANAGER`.
   - Seeded **Staff One** (`staff1@demo.test`) with pill `STAFF`.
4. Click the green **"Add member"** button (`/seller/team/new`).
5. Notice the role selector shows both **Manager** and **Staff** options (because an Owner can create both).
6. Enter details:
   - **Full Name:** `Arun Karki`
   - **Email:** `arun.manager@demo.test`
   - **Role:** Select `Manager`
7. Click **"Create Member"**.
8. Notice the temporary password generated in the highlighted golden card with the **"Copy password"** button.

#### 2. Test Forced Password Change on Login
1. Log out or open an incognito window.
2. Sign in as `arun.manager@demo.test` with the copied temporary password.
3. Because `mustChangePassword` is active, the app automatically navigates to `/change-password` and blocks access to other routes until the password is changed.
4. Enter current password and a new secure password (e.g., `NewManagerPass123!`), then click **"Change Password"**.
5. You are redirected straight into the seller dashboard as Manager!

#### 3. Manager Daily Operations: Catalog, Stock, and Orders
1. Sign in as Manager:
   - **Email:** `manager1@demo.test`
   - **Password:** `Password123!`
2. **Product Management:**
   - In the sidebar, navigate to **Products** (`/seller/products`).
   - Notice the **"Add product"** button is present and clickable (`product.create`).
   - Click **"Edit"** on a product (e.g., *Basmati Rice Premium*) and change the price from Rs 2,800.00 to Rs 2,900.00 (`product.edit`).
3. **Inventory Management:**
   - Navigate to **Inventory** (`/seller/inventory`).
   - Click **"Adjust Stock"** on any variant, select `RECEIPT`, enter `+50`, and save (`stock.adjust`).
4. **Order Management:**
   - Navigate to **Incoming orders** (`/seller/orders`).
   - Click **"Confirm order"** on a pending order (`order.accept`).

#### 4. Manager Permission Boundaries & Hierarchy Enforcement
1. **Refund Protection:**
   - While still on **Incoming orders**, notice that for any order in `REJECTED_REFUND_PENDING` state, the **"Mark refunded"** button is **hidden** (managers do not have `order.mark_refunded`). Any direct API attempt is blocked with 403.
2. **Activity Log Isolation:**
   - Notice that the **Activity** tab is **hidden** in the sidebar (only owners have `audit.view`). Directly navigating to `/seller/activity` is blocked.
3. **Team Creation Boundary:**
   - Navigate to **Team** (`/seller/team`) and click **"Add member"** (`/seller/team/new`).
   - Notice that the role selector **only shows Staff**. Managers cannot create other Managers or Owners.
4. **Hierarchy Action Restrictions:**
   - On the Team list, notice that the Manager can only click **"Reset PW"** or **"Disable"** for **Staff members**. The Owner and other Managers have their action buttons hidden or disabled (`canManage` enforcement).

#### 5. Manager Creates a Staff Account
1. On the Add Team Member page (`/seller/team/new`), create a new staff account:
   - **Full Name:** `Gita Sharma`
   - **Email:** `gita.staff@demo.test`
   - **Role:** `Staff` (pre-selected and locked)
2. Click **"Create Member"** and note the generated temporary password.

#### 6. Owner Inspects the Activity Audit Log
1. Log out and sign back in as the business owner:
   - **Email:** `seller1@demo.test`
   - **Password:** `Password123!`
2. In the sidebar, click **Activity** (`/seller/activity`).
3. Observe the comprehensive immutable audit log:
   - **Catalog Price Update:** Shows the exact price change on Basmati Rice from Rs 2,800.00 to Rs 2,900.00 by `manager1@demo.test`.
   - **Team Member Created:** Shows the creation of `arun.manager@demo.test` (Manager) by `seller1@demo.test`, and `gita.staff@demo.test` (Staff) by `manager1@demo.test`.
   - **Inventory Adjustment:** Shows the stock receipt of `+50` units.
   - **Order Acceptance:** Shows the order status confirmation.
4. Test the **Action Filters**: Toggle between "Catalog / Price Changes", "Team & Members", "Inventory Adjustments", and "All Actions".
5. Notice that passwords and sensitive credentials are **never logged or visible**.

---

**End of demo.**
