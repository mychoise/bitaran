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

**End of demo.**
