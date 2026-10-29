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
  Expense,
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
export type ProductInput = Omit<Product, "id" | "costPricePaisa"> & { costPricePaisa: Paisa };
export type ShopInput = { name: string; ownerName: string; phone: string; address: string; routeId: Id; creditLimitPaisa: Paisa; openingBalancePaisa: Paisa; dueDays: number };
export type SaleLineInput = { productId: Id; quantity: number; unit: SaleUnit };
export type SaleInput = { shopId: Id; planId?: Id; lines: SaleLineInput[]; overrideCreditLimit?: boolean };
export type PaymentInput = { shopId: Id; planId?: Id; method: PaymentMethod; amountPaisa: Paisa; chequeNo?: string; imageIds: Id[] };
export type ReturnInput = { shopId: Id; planId?: Id; lines: { productId: Id; units: number; reason: ReturnReason; restock: boolean }[] };
export type WriteOffInput = { productId: Id; units: number; reason: ReturnReason; note: string; planId?: Id };
export type ExpenseInput = { staffId?: Id; type: ExpenseType; amountPaisa: Paisa; date: BusinessDate; note: string; billImageId?: Id };
export type DayPlanInput = { date: BusinessDate; salesmanId: Id; routeId: Id; issued: StockLine[] };
export type CloseDayInput = { reportedUnsold: StockLine[]; cashHandedOverPaisa: Paisa };
export type ReconcileInput = { counted: StockLine[]; cashCountedPaisa: Paisa };
export type PhotoInput = { planId: Id; shopId: Id; imageId: Id; deviceTakenAt?: string; distanceM?: number };

export type SaleFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; planId?: Id; status?: SaleStatus };
export type PaymentFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; method?: PaymentMethod; status?: PaymentStatus };
export type PlanFilter = PageQuery & DateRange & { salesmanId?: Id; status?: DayPlanStatus };
export type SimpleFilter = PageQuery & DateRange & { shopId?: Id; salesmanId?: Id; staffId?: Id };

// ---- modules ---------------------------------------------------------------------------------

export interface ApiClient {
  /** Who the client acts for. */
  readonly viewer: Viewer;

  business: {
    get(): Promise<Business>;
  };
  staff: {
    list(): Promise<Staff[]>;
    get(id: Id): Promise<Staff>;
    create(input: StaffInput): Promise<Staff>;
    update(id: Id, input: Partial<StaffInput> & { active?: boolean }): Promise<Staff>;
  };
  products: {
    categories(): Promise<Category[]>;
    list(query?: PageQuery & { categoryId?: Id; search?: string; lowStock?: boolean }): Promise<Page<Product>>;
    get(id: Id): Promise<Product>;
    create(input: ProductInput): Promise<Product>;
    update(id: Id, input: Partial<ProductInput>): Promise<Product>;
  };
  shops: {
    routes(): Promise<Route[]>;
    list(query?: PageQuery & { routeId?: Id; search?: string; overdue?: boolean }): Promise<Page<ShopWithBalance>>;
    get(id: Id): Promise<ShopWithBalance>;
    statement(id: Id, range?: DateRange): Promise<StatementEntry[]>;
    create(input: ShopInput): Promise<ShopWithBalance>;
    update(id: Id, input: Partial<ShopInput> & { active?: boolean }): Promise<ShopWithBalance>;
  };
  dayPlans: {
    list(filter?: PlanFilter): Promise<Page<DayPlan>>;
    get(id: Id): Promise<DayPlan>;
    /** The salesman's plan for today, if any. */
    today(): Promise<DayPlan | null>;
    create(input: DayPlanInput): Promise<DayPlan>;
    /** Only a planned plan; its stock goes back to the warehouse. */
    remove(id: Id): Promise<void>;
    start(id: Id): Promise<DayPlan>;
    markVisit(id: Id, shopId: Id, status: "visited" | "skipped", skipReason?: string): Promise<DayPlan>;
    close(id: Id, input: CloseDayInput): Promise<DayPlan>;
    reconcile(id: Id, input: ReconcileInput): Promise<DayPlan>;
  };
  sales: {
    list(filter?: SaleFilter): Promise<Page<Sale>>;
    get(id: Id): Promise<Sale>;
    create(input: SaleInput): Promise<Sale>;
    cancel(id: Id, reason: string): Promise<Sale>;
  };
  payments: {
    list(filter?: PaymentFilter): Promise<Page<Payment>>;
    get(id: Id): Promise<Payment>;
    create(input: PaymentInput): Promise<Payment>;
    confirm(id: Id): Promise<Payment>;
    markBounced(id: Id): Promise<Payment>;
  };
  returns: {
    list(filter?: SimpleFilter): Promise<Page<Return>>;
    create(input: ReturnInput): Promise<Return>;
  };
  writeOffs: {
    list(filter?: SimpleFilter): Promise<Page<WriteOff>>;
    create(input: WriteOffInput): Promise<WriteOff>;
  };
  expenses: {
    list(filter?: SimpleFilter & { type?: ExpenseType }): Promise<Page<Expense>>;
    create(input: ExpenseInput): Promise<Expense>;
  };
  photos: {
    list(filter?: SimpleFilter & { planId?: Id; flagged?: boolean }): Promise<Page<VisitPhoto>>;
    create(input: PhotoInput): Promise<VisitPhoto>;
  };
  reports: {
    dashboard(date?: BusinessDate): Promise<DashboardSummary>;
    salesByDay(range: DateRange): Promise<{ date: BusinessDate; totalPaisa: Paisa; count: number }[]>;
    salesBySalesman(range: DateRange): Promise<{ salesmanId: Id; totalPaisa: Paisa; count: number }[]>;
    overdue(): Promise<{ shopId: Id; overduePaisa: Paisa; oldestDueDate: BusinessDate }[]>;
    lowStock(): Promise<Product[]>;
  };
  /** The logged-in shop's own data. Only shop logins may call these. */
  shopPortal: {
    summary(): Promise<ShopSummary>;
    statement(range?: DateRange): Promise<StatementEntry[]>;
    invoices(query?: PageQuery & DateRange): Promise<Page<Sale>>;
    invoice(id: Id): Promise<Sale>;
    payments(query?: PageQuery & DateRange): Promise<Page<Payment>>;
    returns(query?: PageQuery & DateRange): Promise<Page<Return>>;
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
