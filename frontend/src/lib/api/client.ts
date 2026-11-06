// The one interface between the screens and the data. Two implementations:
// mock/ (in the browser, used now) and http.ts (stub until the backend is connected).
// Every method here is listed in docs/api-contract.md with its HTTP shape and who may call it.

import type { BusinessDate } from "../dates.ts";
import type { Paisa } from "../money.ts";
import type {
  Business,
  Category,
  DashboardSummary,
  DateRange,
  DayPlan,
  DayPlanStatus,
  DayReport,
  Expense,
  ExpenseSummary,
  SalesmanHistoryEntry,
  Order,
  OrderPaymentMode,
  OrderStatus,
  ShopInvoice,
  ShopPayment,
  ShopProfile,
  ShopReturn,
  LowStockItem,
  ExpenseType,
  Id,
  Page,
  PageQuery,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  Return,
  ReturnReason,
  Route,
  Sale,
  SaleStatus,
  SaleUnit,
  ItemTaken,
  SalesmanAnalytics,
  ShopBalance,
  TodayReport,
  VisitShop,
  ShopSummary,
  ShopWithBalance,
  Staff,
  StaffRole,
  StatementEntry,
  StockLine,
  Viewer,
  VisitPhoto,
  WriteOff,
} from "./types.ts";

// ---- inputs and filters --------------------------------------------------------------------

export type StaffInput = { fullName: string; role: Exclude<StaffRole, "owner">; email: string; phone: string };
/** A new account starts with a temporary password the manager types and passes on in person. */
export type StaffCreateInput = StaffInput & { temporaryPassword: string };
export type StaffUpdateInput = Partial<StaffInput> & { active?: boolean };
export type StaffFilter = { search?: string; role?: StaffRole; active?: boolean };
export type BusinessInput = Pick<Business, "name" | "phone" | "email" | "address" | "city" | "registrationNo"> & {
  /** An id from uploads.image; null removes the logo. */
  logoImageId?: Id | null;
};
/** Stock is set once on create ("opening stock"); after that it changes only through stock moves. */
export type ProductInput = Omit<Product, "id" | "costPricePaisa" | "imageId" | "imageUrl"> & {
  costPricePaisa: Paisa;
  /** An id from uploads.image; null removes the image. */
  imageId?: Id | null;
};
export type ProductUpdateInput = Partial<Omit<ProductInput, "stockUnits">>;
export type ProductFilter = PageQuery & { categoryId?: Id; search?: string; lowStock?: boolean; active?: boolean };
export type ShopInput = {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  routeId: Id | null;
  pan: string;
  /** An id from uploads.image; null removes the photo. */
  panImageId?: Id | null;
  registrationNo: string;
  latitude: number | null;
  longitude: number | null;
  creditLimitPaisa: Paisa;
  openingBalancePaisa: Paisa;
  dueDays: number;
};
/** A shop can get its login when it is added, or later: an email and a temporary password, together. */
export type ShopLoginInput = { loginEmail?: string; temporaryPassword?: string };
export type ShopCreateInput = ShopInput & ShopLoginInput;
export type ShopUpdateInput = Partial<ShopInput> & ShopLoginInput & { active?: boolean };
export type ShopFilter = PageQuery & { routeId?: Id | "none"; search?: string; overdue?: boolean; active?: boolean };
export type RouteInput = { name: string };
export type SaleLineInput = { productId: Id; quantity: number; unit: SaleUnit };
/** Every submit carries a key made once per attempt; the same key again returns the first result. */
type Once = { idempotencyKey: string };
/** A sale on a visit. Prices come from the product records on the server, never from here. */
export type SaleInput = Once & {
  visitId: Id;
  lines: SaleLineInput[];
  discountPaisa: Paisa;
  /** When the credit part is due; the shop's usual days when left out. */
  dueDate?: BusinessDate;
  /** Paid in cash at the counter; recorded as a cash payment against the sale. */
  cashPaidPaisa: Paisa;
  overrideCreditLimit?: boolean;
  /** The open order this sale delivers. */
  orderId?: Id;
};
export type OrderInput = { shopId: Id; salesmanId: Id; lines: SaleLineInput[]; paymentMode: OrderPaymentMode; prepaidPaymentId?: Id; note?: string };
export type OrderFilter = PageQuery & { status?: OrderStatus; shopId?: Id; salesmanId?: Id };
/** A salesman pays on a visit; the office names the shop instead. */
export type PaymentInput = Once & {
  visitId?: Id;
  shopId?: Id;
  saleId?: Id;
  method: PaymentMethod;
  amountPaisa: Paisa;
  chequeNo?: string;
  bank?: string;
  chequeDate?: BusinessDate;
  reference?: string;
  imageIds: Id[];
};
export type ReturnLineInput = { productId: Id; units: number; reason: ReturnReason; restock: boolean; /** Managers only: a credited value other than the price. */ valuePaisa?: Paisa };
/** A salesman returns on a visit; a manager names the shop instead. */
export type ReturnInput = Once & { visitId?: Id; shopId?: Id; lines: ReturnLineInput[] };
export type WriteOffInput = Once & { productId: Id; unit: SaleUnit; quantity: number; reason: ReturnReason; note: string; planId?: Id };
export type ExpenseInput = Once & { staffId?: Id; type: ExpenseType; amountPaisa: Paisa; date: BusinessDate; note: string; billImageId?: Id; planId?: Id; salaryMonth?: string };
/** Owner or manager. `null` clears an optional field. */
export type ExpenseUpdate = Partial<{ staffId: Id; type: ExpenseType; amountPaisa: Paisa; date: BusinessDate; note: string; billImageId: Id | null; planId: Id | null; salaryMonth: string | null }>;
/** One line of stock to issue: pieces (the product's own unit) or cartons. */
export type IssueLineInput = { productId: Id; unit: SaleUnit; quantity: number };
export type DayPlanInput = { date: BusinessDate; salesmanId: Id; routeId: Id; lines: IssueLineInput[] };
export type CloseDayInput = { reportedUnsold: StockLine[]; cashHandedOverPaisa: Paisa };
export type VisitUpdateInput = { status: "visited" | "skipped"; skipReason?: string };
export type ReconcileInput = { counted: StockLine[]; cashCountedPaisa: Paisa; notes: string };
export type PhotoInput = Once & { visitId: Id; imageId: Id; note: string; deviceTakenAt?: string; latitude?: number; longitude?: number };

export type SaleFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; planId?: Id; status?: SaleStatus };
export type PaymentFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; planId?: Id; saleId?: Id; method?: PaymentMethod; status?: PaymentStatus };
export type PlanFilter = PageQuery & DateRange & { salesmanId?: Id; status?: DayPlanStatus };
export type SimpleFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; staffId?: Id };

// ---- modules ---------------------------------------------------------------------------------

export interface ApiClient {
  /** Who the client acts for. */
  readonly viewer: Viewer;

  business: {
    get(): Promise<Business>;
    /** Owner only. The PAN cannot be changed. */
    update(input: Partial<BusinessInput>): Promise<Business>;
  };
  staff: {
    list(filter?: StaffFilter): Promise<Staff[]>;
    get(id: Id): Promise<Staff>;
    create(input: StaffCreateInput): Promise<Staff>;
    update(id: Id, input: StaffUpdateInput): Promise<Staff>;
    resetPassword(id: Id, temporaryPassword: string): Promise<void>;
  };
  uploads: {
    /** Stores an image and returns its id, to attach to a record. */
    image(file: Blob): Promise<{ id: Id; url: string }>;
  };
  categories: {
    list(): Promise<Category[]>;
    create(name: string): Promise<Category>;
    rename(id: Id, name: string): Promise<Category>;
    /** Only a category no product uses. */
    remove(id: Id): Promise<void>;
  };
  products: {
    list(query?: ProductFilter): Promise<Page<Product>>;
    get(id: Id): Promise<Product>;
    create(input: ProductInput): Promise<Product>;
    update(id: Id, input: ProductUpdateInput): Promise<Product>;
    /** Adds a signed number of base units. Stock never goes below zero. Not logged yet. */
    adjustStock(id: Id, deltaUnits: number): Promise<Product>;
  };
  routes: {
    list(): Promise<Route[]>;
    get(id: Id): Promise<Route>;
    create(input: RouteInput): Promise<Route>;
    update(id: Id, input: RouteInput): Promise<Route>;
    /** Only a route with no shops and no day plans. */
    remove(id: Id): Promise<void>;
    /** Replaces the route's shops with this ordered list. A shop added here leaves its old route. */
    setShops(id: Id, shopIds: Id[]): Promise<Route>;
  };
  shops: {
    list(query?: ShopFilter): Promise<Page<ShopWithBalance>>;
    get(id: Id): Promise<ShopWithBalance>;
    create(input: ShopCreateInput): Promise<ShopWithBalance>;
    update(id: Id, input: ShopUpdateInput): Promise<ShopWithBalance>;
    resetPassword(id: Id, temporaryPassword: string): Promise<void>;
    balance(id: Id): Promise<ShopBalance>;
    statement(id: Id, range?: DateRange): Promise<StatementEntry[]>;
    itemsTaken(id: Id, range?: DateRange): Promise<ItemTaken[]>;
    /** What the shop can still return of each product: bought less returned, by anyone. */
    returnable(id: Id): Promise<{ productId: Id; units: number }[]>;
  };
  dayPlans: {
    list(filter?: PlanFilter): Promise<Page<DayPlan>>;
    get(id: Id): Promise<DayPlan>;
    /** The salesman's plan for today, if any. */
    today(): Promise<DayPlan | null>;
    create(input: DayPlanInput): Promise<DayPlan>;
    /** Only a planned plan; its stock goes back to the warehouse. */
    remove(id: Id): Promise<void>;
    /** Only today's planned day, and only one day in progress per salesman. */
    start(id: Id): Promise<DayPlan>;
    /** The day's visits in order, each with its shop, balance and today's purchases. */
    shops(id: Id): Promise<VisitShop[]>;
    /** An ad-hoc visit: a shop not on the route, added at the end. Only while in progress. */
    addVisit(id: Id, shopId: Id): Promise<VisitShop>;
    close(id: Id, input: CloseDayInput): Promise<DayPlan>;
    /** Only a closed plan. Counted stock goes back to the warehouse. */
    reconcile(id: Id, input: ReconcileInput): Promise<DayPlan>;
    /** The plan with its stock, cash, sales, payments and visits worked out. */
    report(id: Id): Promise<DayReport>;
  };
  visits: {
    get(id: Id): Promise<VisitShop>;
    /** Visited, or skipped with a reason. Only while the day is in progress. */
    update(id: Id, input: VisitUpdateInput): Promise<VisitShop>;
  };
  sales: {
    list(filter?: SaleFilter): Promise<Page<Sale>>;
    get(id: Id): Promise<Sale>;
    create(input: SaleInput): Promise<Sale>;
    cancel(id: Id, reason: string): Promise<Sale>;
  };
  orders: {
    list(filter?: OrderFilter): Promise<Page<Order>>;
    get(id: Id): Promise<Order>;
    /** Owner or manager. */
    create(input: OrderInput): Promise<Order>;
    /** Owner or manager; only an open order. */
    cancel(id: Id, reason: string): Promise<Order>;
  };
  payments: {
    list(filter?: PaymentFilter): Promise<Page<Payment>>;
    get(id: Id): Promise<Payment>;
    create(input: PaymentInput): Promise<Payment>;
    /** Confirm, or mark bounced. Only from pending, once. */
    decide(id: Id, status: "confirmed" | "bounced"): Promise<Payment>;
  };
  returns: {
    list(filter?: SimpleFilter): Promise<Page<Return>>;
    get(id: Id): Promise<Return>;
    create(input: ReturnInput): Promise<Return>;
  };
  writeOffs: {
    list(filter?: SimpleFilter): Promise<Page<WriteOff>>;
    create(input: WriteOffInput): Promise<WriteOff>;
  };
  expenses: {
    list(filter?: SimpleFilter & { type?: ExpenseType }): Promise<Page<Expense>>;
    get(id: Id): Promise<Expense>;
    create(input: ExpenseInput): Promise<Expense>;
    /** Owner or manager. No edit history is kept yet. */
    update(id: Id, patch: ExpenseUpdate): Promise<Expense>;
    /** Owner or manager. */
    summary(filter: Required<DateRange> & { staffId?: Id; type?: ExpenseType }): Promise<ExpenseSummary>;
  };
  photos: {
    list(filter?: SimpleFilter & { planId?: Id; flagged?: boolean }): Promise<Page<VisitPhoto>>;
    get(id: Id): Promise<VisitPhoto>;
    create(input: PhotoInput): Promise<VisitPhoto>;
  };
  reports: {
    dashboard(date?: BusinessDate): Promise<DashboardSummary>;
    salesByDay(range: DateRange): Promise<{ date: BusinessDate; totalPaisa: Paisa; count: number }[]>;
    salesBySalesman(range: DateRange): Promise<{ salesmanId: Id; totalPaisa: Paisa; count: number }[]>;
    overdue(): Promise<{ shopId: Id; overduePaisa: Paisa; oldestDueDate: BusinessDate }[]>;
    /** Active products at or below their low-stock level, with units sold in the range (default the last 30 days). */
    lowStock(range?: Required<DateRange>): Promise<LowStockItem[]>;
    /** Today's sales: the salesman's own, or everyone's for a manager. A manager may ask for a date range. */
    today(range?: Required<DateRange>): Promise<TodayReport>;
    salesmanAnalytics(salesmanId: Id, range: Required<DateRange>): Promise<SalesmanAnalytics>;
    /** Every sale and payment the salesman took in the range, newest first. Owner or manager. */
    salesmanHistory(salesmanId: Id, range: Required<DateRange>): Promise<SalesmanHistoryEntry[]>;
  };
  /** The logged-in shop's own data. Only shop logins may call these. */
  shopPortal: {
    /** GET /shop/me */
    me(): Promise<ShopProfile>;
    /** GET /shop/me/balance */
    summary(): Promise<ShopSummary>;
    /** GET /shop/me/statement */
    statement(range?: DateRange): Promise<StatementEntry[]>;
    invoices(query?: PageQuery & DateRange & { status?: SaleStatus }): Promise<Page<ShopInvoice>>;
    invoice(id: Id): Promise<ShopInvoice>;
    payments(query?: PageQuery & DateRange & { status?: PaymentStatus }): Promise<Page<ShopPayment>>;
    returns(query?: PageQuery & DateRange): Promise<Page<ShopReturn>>;
  };
}

/** Every failure a screen can explain. Messages are plain; codes never reach the user. */
export type ApiErrorCode = "not_found" | "forbidden" | "invalid" | "conflict" | "unreachable" | "not_built_yet";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}
