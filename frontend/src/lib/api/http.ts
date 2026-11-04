import { ApiError, type ApiClient } from "./client.ts";
import type { Viewer } from "./types.ts";

// STUB. The real backend is not connected yet.
// When it is, each method becomes a call to the backend following docs/api-contract.md.
// Until then every call fails, and the screens show their error state with a Retry button.

const notConnected = async (): Promise<never> => {
  throw new ApiError("unreachable", "Backend not connected yet");
};

export function createHttpClient(viewer: Viewer): ApiClient {
  const m = <T extends object>(names: (keyof T)[]) => Object.fromEntries(names.map((n) => [n, notConnected])) as unknown as T;
  return {
    viewer,
    business: m<ApiClient["business"]>(["get", "update"]),
    staff: m<ApiClient["staff"]>(["list", "get", "create", "update", "resetPassword"]),
    uploads: m<ApiClient["uploads"]>(["image"]),
    categories: m<ApiClient["categories"]>(["list", "create", "rename", "remove"]),
    products: m<ApiClient["products"]>(["list", "get", "create", "update", "adjustStock"]),
    routes: m<ApiClient["routes"]>(["list", "get", "create", "update", "remove", "setShops"]),
    shops: m<ApiClient["shops"]>(["list", "get", "create", "update", "resetPassword", "balance", "statement", "itemsTaken", "returnable"]),
    dayPlans: m<ApiClient["dayPlans"]>(["list", "get", "today", "create", "remove", "start", "shops", "addVisit", "close", "reconcile", "report"]),
    visits: m<ApiClient["visits"]>(["get", "update"]),
    sales: m<ApiClient["sales"]>(["list", "get", "create", "cancel"]),
    payments: m<ApiClient["payments"]>(["list", "get", "create", "decide"]),
    returns: m<ApiClient["returns"]>(["list", "get", "create"]),
    writeOffs: m<ApiClient["writeOffs"]>(["list", "create"]),
    expenses: m<ApiClient["expenses"]>(["list", "get", "create", "update", "summary"]),
    photos: m<ApiClient["photos"]>(["list", "get", "create"]),
    reports: m<ApiClient["reports"]>(["dashboard", "salesByDay", "salesBySalesman", "overdue", "lowStock", "today", "salesmanAnalytics", "salesmanHistory"]),
    shopPortal: m<ApiClient["shopPortal"]>(["summary", "statement", "invoices", "invoice", "payments", "returns"]),
  };
}
