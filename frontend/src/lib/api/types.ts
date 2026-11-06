// Domain types shared by the UI, the mock and (later) the http client.
// Money is integer paisa; business dates are Nepal "YYYY-MM-DD"; instants are ISO strings.
// docs/api-contract.md describes the same shapes for the backend.

import type { BusinessDate } from "../dates.ts";
import type { Paisa } from "../money.ts";

export type Id = string;
export type Instant = string;
export type StaffRole = "owner" | "manager" | "salesman";

/** Who is looking. The mock scopes every answer by this, as the real backend will. */
export type Viewer = { id: Id; type: "staff"; role: StaffRole; name: string } | { id: Id; type: "shop"; name: string };

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type PageQuery = { page?: number; pageSize?: number };
export type DateRange = { from?: BusinessDate; to?: BusinessDate };

export type Business = {
  id: Id;
  name: string;
  /** Set once at sign-up. Shown, never edited in the app. */
  pan: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  /** Company registration number, if the business has one. */
  registrationNo: string;
  logoImageId?: Id;
  /** Where to load the logo from. Sent by the server; never written by the app. */
  logoUrl?: string;
};

export type Staff = {
  id: Id;
  fullName: string;
  role: StaffRole;
  email: string;
  phone: string;
  /** Inactive people cannot sign in. Their records stay; nobody is ever deleted. */
  active: boolean;
  joinedOn: BusinessDate;
  lastLoginAt?: Instant;
  /** When a manager last set a temporary password. The password itself is never sent back. */
  passwordResetAt?: Instant;
};

export type Category = {
  id: Id;
  name: string;
  /** Products in this category, active or not. Sent by the server. A category in use cannot be deleted. */
  productCount: number;
};

export type Product = {
  id: Id;
  name: string;
  /** Stock-keeping code, unique in the business. */
  sku: string;
  categoryId: Id;
  /** The base unit stock is counted in, e.g. "packet", "bottle". */
  unitName: string;
  /** Null when the product is not sold by the carton. Otherwise above zero. */
  unitsPerCarton: number | null;
  unitPricePaisa: Paisa;
  /** Set exactly when unitsPerCarton is. */
  cartonPricePaisa: Paisa | null;
  /** Per base unit. Present only for owners and managers. */
  costPricePaisa?: Paisa;
  /** Warehouse stock, in base units. */
  stockUnits: number;
  lowStockUnits: number;
  /** Inactive products are not sold. Products are never deleted. */
  active: boolean;
  imageId?: Id;
  /** Where to load the image from. Sent by the server; never written by the app. */
  imageUrl?: string;
};

export type Route = { id: Id; name: string; shopIds: Id[] };

export type Shop = {
  id: Id;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  /** Null while the shop is on no route. */
  routeId: Id | null;
  /** The shop's PAN, 9 digits, unique in the business. "" when it has none. */
  pan: string;
  /** A photo of the PAN card, when there is one. */
  panImageId?: Id;
  /** Where to load the PAN card photo from. Sent by the server; never written by the app. */
  panImageUrl?: string;
  registrationNo: string;
  /** Where the shop is, typed in as numbers (no map). Both set, or both null. */
  latitude: number | null;
  longitude: number | null;
  creditLimitPaisa: Paisa;
  /** Owed when the shop was added. Negative means it started with credit. */
  openingBalancePaisa: Paisa;
  /** Days after a sale before it is due. */
  dueDays: number;
  /** Inactive shops are not visited or sold to. Shops are never deleted. */
  active: boolean;
  hasLogin: boolean;
  /** The email the shop signs in with, when it has a login. Unique across shops. */
  loginEmail?: string;
  /** When a manager last set a temporary password. The password itself is never sent back. */
  passwordResetAt?: Instant;
  /** Who added the shop. A salesman's shops start with no credit and no opening balance. */
  createdByRole?: StaffRole;
};

export type ShopWithBalance = Shop & {
  /** Owed by the shop. Negative means the shop has credit. */
  balancePaisa: Paisa;
  /** Pending cheque and online payments, not yet counted. */
  inClearingPaisa: Paisa;
  overduePaisa: Paisa;
};

/** A shop's balance, part by part. */
export type ShopBalance = {
  openingPaisa: Paisa;
  salesPaisa: Paisa;
  paymentsPaisa: Paisa;
  returnsPaisa: Paisa;
  /** Owed: opening + sales − payments − returns. Negative means the shop has credit. */
  balancePaisa: Paisa;
  /** Pending cheques and online payments, not yet counted. */
  inClearingPaisa: Paisa;
  overduePaisa: Paisa;
  creditLimitPaisa: Paisa;
  /** How much of the credit limit the balance uses, 0 when the shop owes nothing. */
  creditUsedPaisa: Paisa;
};

/** What a shop has taken to date: one row per product and unit, from confirmed sales. */
export type ItemTaken = { productId: Id; unit: "unit" | "carton"; quantity: number; baseUnits: number; totalPaisa: Paisa };

export type StockLine = { productId: Id; units: number };

export type DayPlanStatus = "planned" | "in_progress" | "closed" | "reconciled";
export type VisitStatus = "pending" | "visited" | "skipped";
export type Visit = {
  id: Id;
  shopId: Id;
  status: VisitStatus;
  /** When it was marked visited or skipped. */
  at?: Instant;
  skipReason?: string;
  /** Added on the day: a shop that was not on the route. */
  adHoc?: boolean;
};

/** A visit with its shop, as the salesman sees it on the day. */
export type VisitShop = {
  visit: Visit;
  planId: Id;
  planStatus: DayPlanStatus;
  /** Its place in the day's list, from 1. */
  position: number;
  shop: ShopWithBalance;
  /** Confirmed sales to this shop on this plan. */
  todayPurchasesPaisa: Paisa;
  todaySalesCount: number;
};

export type DayPlan = {
  id: Id;
  date: BusinessDate;
  salesmanId: Id;
  routeId: Id;
  status: DayPlanStatus;
  issued: StockLine[];
  visits: Visit[];
  /** The salesman's own count of unsold stock, when closing. */
  reportedUnsold?: StockLine[];
  /** The manager's count when reconciling. It wins over the salesman's number. */
  counted?: StockLine[];
  /** What the salesman says he handed over at closing. */
  cashHandedOverPaisa?: Paisa;
  /** What the manager counted when reconciling. */
  cashCountedPaisa?: Paisa;
  /** The manager's notes when reconciling. */
  reconcileNotes?: string;
  reconciledBy?: Id;
  createdAt?: Instant;
  startedAt?: Instant;
  closedAt?: Instant;
  reconciledAt?: Instant;
};

/** One product's stock on a day plan. All in base units. */
export type DayStockLine = {
  productId: Id;
  issued: number;
  sold: number;
  /** issued − sold − written off: what should still be with the salesman. */
  remaining: number;
  /** The salesman's count at closing, when closed. */
  reportedUnsold: number | null;
  /** The manager's count, once reconciled. */
  counted: number | null;
  writtenOff: number;
  /** issued − sold − back − written off, using the manager's count once there is one. */
  shortage: number | null;
};

/** A day plan with everything worked out: the plan's page and the end-of-day report. */
export type DayReport = {
  plan: DayPlan;
  stock: DayStockLine[];
  cash: {
    /** Confirmed cash payments taken on this plan. */
    collectedPaisa: Paisa;
    handedOverPaisa: Paisa | null;
    countedPaisa: Paisa | null;
    /** counted (or handed over, before reconcile) − collected. Negative is cash missing. */
    differencePaisa: Paisa | null;
  };
  sales: { count: number; totalPaisa: Paisa };
  payments: { method: PaymentMethod; count: number; amountPaisa: Paisa; pendingCount: number }[];
  visits: { visited: number; skipped: number; pending: number };
};

export type SaleUnit = "unit" | "carton";
export type SaleLine = {
  productId: Id;
  quantity: number;
  unit: SaleUnit;
  /** Stock used, in base units (cartons × units per carton). */
  baseUnits: number;
  /** From the product record at the time of sale; never typed by the salesman. */
  pricePaisa: Paisa;
  totalPaisa: Paisa;
};

export type SaleStatus = "confirmed" | "cancelled";
export type Sale = {
  id: Id;
  invoiceNo: number;
  date: BusinessDate;
  createdAt: Instant;
  planId?: Id;
  salesmanId: Id;
  shopId: Id;
  lines: SaleLine[];
  totalPaisa: Paisa;
  dueDate: BusinessDate;
  status: SaleStatus;
  cancelledAt?: Instant;
  cancelReason?: string;
  /** The visit it was made on, for a salesman's sale. */
  visitId?: Id;
  /** Lines added up, before the discount. totalPaisa = subtotal − discount. */
  subtotalPaisa?: Paisa;
  discountPaisa?: Paisa;
  /** Cash paid at the counter for this sale; recorded as a cash payment against it. */
  cashPaidPaisa?: Paisa;
  /** Set when a manager or owner allowed a sale over the credit limit. */
  limitOverrideBy?: Id;
  cancelledBy?: Id;
  /** Confirmed payments made against this sale. Sent by the server. */
  paidPaisa?: Paisa;
};

export type PaymentMethod = "cash" | "cheque" | "online";
export type PaymentStatus = "confirmed" | "pending" | "bounced";
export type Payment = {
  id: Id;
  date: BusinessDate;
  createdAt: Instant;
  shopId: Id;
  salesmanId: Id;
  planId?: Id;
  /** The sale this payment is for, when it was taken against one invoice. */
  saleId?: Id;
  method: PaymentMethod;
  amountPaisa: Paisa;
  status: PaymentStatus;
  chequeNo?: string;
  bank?: string;
  chequeDate?: BusinessDate;
  /** The online payment's reference number. */
  reference?: string;
  visitId?: Id;
  /** Addresses of the images, in the same order as imageIds. Sent by the server. */
  imageUrls?: string[];
  /** Cheque photos or online screenshots. */
  imageIds: Id[];
  decidedAt?: Instant;
  decidedBy?: Id;
};

export type ReturnReason = "damaged" | "expired" | "other";
export type ReturnLine = { productId: Id; units: number; reason: ReturnReason; restocked: boolean; valuePaisa: Paisa };
export type Return = {
  id: Id;
  date: BusinessDate;
  createdAt: Instant;
  shopId: Id;
  salesmanId: Id;
  planId?: Id;
  visitId?: Id;
  lines: ReturnLine[];
  valuePaisa: Paisa;
};

export type WriteOff = {
  id: Id;
  date: BusinessDate;
  createdAt?: Instant;
  productId: Id;
  /** In base units. The unit and quantity as typed are kept beside it. */
  units: number;
  unit?: SaleUnit;
  quantity?: number;
  reason: ReturnReason;
  note: string;
  planId?: Id;
  createdBy: Id;
};

export type ExpenseType = "salary" | "fuel" | "khaja" | "misc";
export type Expense = {
  id: Id;
  date: BusinessDate;
  staffId: Id;
  type: ExpenseType;
  amountPaisa: Paisa;
  /** The description. */
  note: string;
  billImageId?: Id;
  /** Fuel and khaja: the day plan it was spent on, if any. */
  planId?: Id;
  /** Salary: the month it covers, "YYYY-MM". */
  salaryMonth?: string;
  createdBy?: Id;
  createdAt?: Instant;
  /** The last edit. No history of edits is kept yet. */
  updatedAt?: Instant;
  updatedBy?: Id;
  /** Where to load the bill photo from. Sent by the server. */
  billImageUrl?: string;
};

/** Expense totals over a date range, by type and by month (of the expense date). */
export type ExpenseSummary = {
  from: BusinessDate;
  to: BusinessDate;
  totalPaisa: Paisa;
  count: number;
  byType: { type: ExpenseType; count: number; amountPaisa: Paisa }[];
  byMonth: { month: string; totalPaisa: Paisa; byType: Record<ExpenseType, Paisa> }[];
};

export type PhotoFlag = "old_photo" | "far_from_shop" | "duplicate" | "no_photo_data";
export type VisitPhoto = {
  id: Id;
  planId: Id;
  shopId: Id;
  salesmanId: Id;
  /** Server time: the real time of the visit. */
  takenAt: Instant;
  /** The camera's own time (EXIF), if it had one. */
  deviceTakenAt?: Instant;
  distanceM?: number;
  /** Where the phone was when the photo was taken, if it sent its location. */
  latitude?: number;
  longitude?: number;
  imageId: Id;
  flags: PhotoFlag[];
  visitId?: Id;
  note?: string;
  /** Where to load the image from. Sent by the server. */
  imageUrl?: string;
};

/** Today's sales for the signed-in salesman (all salesmen for a manager), shop by shop. */
export type TodayReport = {
  /** The last day of the range (today, for a salesman). */
  date: BusinessDate;
  from: BusinessDate;
  to: BusinessDate;
  count: number;
  totalPaisa: Paisa;
  cashCollectedPaisa: Paisa;
  byShop: { shopId: Id; count: number; totalPaisa: Paisa; cashPaisa: Paisa }[];
  /** Per salesman, biggest first. A salesman sees only their own row. */
  bySalesman: { salesmanId: Id; count: number; totalPaisa: Paisa; cashPaisa: Paisa }[];
};

/** One line of a salesman's history: a sale or a payment they took. */
export type SalesmanHistoryEntry = {
  kind: "sale" | "payment";
  id: Id;
  date: BusinessDate;
  /** When it was recorded, for ordering inside a day. */
  at: Instant;
  shopId: Id;
  amountPaisa: Paisa;
  status: SaleStatus | PaymentStatus;
  /** The invoice number for a sale; the method for a payment. */
  ref: string;
};

/** A low-stock product, with what sold of it in the report's dates. */
export type LowStockItem = Product & { /** Left out when the server cannot work it out. */ soldUnits?: number };

/** One salesman's numbers over a date range. Confirmed sales only; bounced payments left out. */
export type SalesmanAnalytics = {
  from: BusinessDate;
  to: BusinessDate;
  sales: { count: number; totalPaisa: Paisa };
  payments: { method: PaymentMethod; count: number; amountPaisa: Paisa; pendingCount: number }[];
  perDay: { date: BusinessDate; count: number; totalPaisa: Paisa }[];
  perShop: { shopId: Id; count: number; totalPaisa: Paisa }[];
  topProducts: { productId: Id; baseUnits: number; totalPaisa: Paisa }[];
  returnsPaisa: Paisa;
  expensesPaisa: Paisa;
  /** Over the reconciled day plans in the range: units not accounted for, valued at the unit price. */
  shortage: { plans: number; units: number; valuePaisa: Paisa; byProduct: { productId: Id; units: number; valuePaisa: Paisa }[] };
};

export type DashboardSummary = {
  date: BusinessDate;
  salesTodayPaisa: Paisa;
  salesTodayCount: number;
  collectedTodayPaisa: Paisa;
  /** Confirmed cash payments today. */
  cashTodayPaisa: Paisa;
  /** Cheque and online payments waiting for a decision (any date). */
  pendingPaymentCount: number;
  inClearingPaisa: Paisa;
  overduePaisa: Paisa;
  overdueShopCount: number;
  lowStockCount: number;
  plansByStatus: Record<DayPlanStatus, number>;
  flaggedPhotoCount: number;
};

export type StatementEntry = {
  date: BusinessDate;
  kind: "opening" | "sale" | "payment" | "return";
  ref: string;
  /** Raises what the shop owes. */
  debitPaisa: Paisa;
  /** Lowers what the shop owes. */
  creditPaisa: Paisa;
  balancePaisa: Paisa;
};

export type ShopSummary = {
  shopName: string;
  businessName: string;
  balancePaisa: Paisa;
  inClearingPaisa: Paisa;
  creditLimitPaisa: Paisa;
  /** max(0, balance): how much of the limit is in use. */
  creditUsedPaisa: Paisa;
  overduePaisa: Paisa;
  oldestOverdueDate?: BusinessDate;
  /** The latest payment that was not bounced. */
  lastPayment?: { date: BusinessDate; amountPaisa: Paisa; method: PaymentMethod; status: PaymentStatus };
};

/** What a shop sees about itself and the business it buys from. */
export type ShopProfile = {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  /** "" when the shop has none. */
  pan: string;
  registrationNo: string;
  loginEmail?: string;
  business: { name: string; address: string; city: string; phone: string; pan: string };
};

/** An invoice as the shop sees it: names instead of internal ids, never a cost price. */
export type ShopInvoice = {
  id: Id;
  invoiceNo: number;
  date: BusinessDate;
  createdAt: Instant;
  dueDate: BusinessDate;
  status: SaleStatus;
  lines: { productName: string; unitName: string; unit: SaleUnit; quantity: number; pricePaisa: Paisa; totalPaisa: Paisa }[];
  subtotalPaisa?: Paisa;
  discountPaisa: Paisa;
  totalPaisa: Paisa;
  /** Confirmed payments against this invoice. */
  paidPaisa: Paisa;
  salesmanName: string;
  cancelledAt?: Instant;
  cancelReason?: string;
  /** Payments linked to this invoice (detail only). */
  payments?: { date: BusinessDate; method: PaymentMethod; amountPaisa: Paisa; status: PaymentStatus }[];
};

export type ShopPayment = {
  id: Id;
  date: BusinessDate;
  method: PaymentMethod;
  amountPaisa: Paisa;
  status: PaymentStatus;
  chequeNo?: string;
  bank?: string;
  reference?: string;
  /** The invoice it was paid against, if any. */
  invoiceNo?: number;
};

export type ShopReturn = {
  id: Id;
  date: BusinessDate;
  lines: { productName: string; unitName: string; units: number; reason: ReturnReason }[];
  valuePaisa: Paisa;
};
