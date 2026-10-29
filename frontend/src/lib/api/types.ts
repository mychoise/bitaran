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

export type Business = { id: Id; name: string; pan: string; address: string; phone: string };

export type Staff = {
  id: Id;
  fullName: string;
  role: StaffRole;
  email: string;
  phone: string;
  active: boolean;
  joinedOn: BusinessDate;
};

export type Category = { id: Id; name: string };

export type Product = {
  id: Id;
  name: string;
  categoryId: Id;
  /** The base unit stock is counted in, e.g. "packet", "bottle". */
  unitName: string;
  unitsPerCarton: number;
  unitPricePaisa: Paisa;
  cartonPricePaisa: Paisa;
  /** Per base unit. Present only for owners and managers. */
  costPricePaisa?: Paisa;
  /** Warehouse stock, in base units. */
  stockUnits: number;
  lowStockUnits: number;
  active: boolean;
};

export type Route = { id: Id; name: string; shopIds: Id[] };

export type Shop = {
  id: Id;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  routeId: Id;
  creditLimitPaisa: Paisa;
  openingBalancePaisa: Paisa;
  /** Days after a sale before it is due. */
  dueDays: number;
  active: boolean;
  hasLogin: boolean;
};

export type ShopWithBalance = Shop & {
  /** Owed by the shop. Negative means the shop has credit. */
  balancePaisa: Paisa;
  /** Pending cheque and online payments, not yet counted. */
  inClearingPaisa: Paisa;
  overduePaisa: Paisa;
};

export type StockLine = { productId: Id; units: number };

export type DayPlanStatus = "planned" | "in_progress" | "closed" | "reconciled";
export type VisitStatus = "pending" | "visited" | "skipped";
export type Visit = { shopId: Id; status: VisitStatus; at?: Instant; skipReason?: string };

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
  cashHandedOverPaisa?: Paisa;
  cashCountedPaisa?: Paisa;
  startedAt?: Instant;
  closedAt?: Instant;
  reconciledAt?: Instant;
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
  /** Set when a manager or owner allowed a sale over the credit limit. */
  limitOverrideBy?: Id;
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
  lines: ReturnLine[];
  valuePaisa: Paisa;
};

export type WriteOff = {
  id: Id;
  date: BusinessDate;
  productId: Id;
  units: number;
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
  note: string;
  billImageId?: Id;
};

export type PhotoFlag = "old_photo" | "far_from_shop" | "duplicate";
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
  imageId: Id;
  flags: PhotoFlag[];
};

export type DashboardSummary = {
  date: BusinessDate;
  salesTodayPaisa: Paisa;
  salesTodayCount: number;
  collectedTodayPaisa: Paisa;
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
  overduePaisa: Paisa;
  oldestOverdueDate?: BusinessDate;
};
