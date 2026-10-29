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
    business: m<ApiClient["business"]>(["get"]),
    staff: m<ApiClient["staff"]>(["list", "get", "create", "update"]),
    products: m<ApiClient["products"]>(["categories", "list", "get", "create", "update"]),
    shops: m<ApiClient["shops"]>(["routes", "list", "get", "statement", "create", "update"]),
    dayPlans: m<ApiClient["dayPlans"]>(["list", "get", "today", "create", "remove", "start", "markVisit", "close", "reconcile"]),
    sales: m<ApiClient["sales"]>(["list", "get", "create", "cancel"]),
    payments: m<ApiClient["payments"]>(["list", "get", "create", "confirm", "markBounced"]),
    returns: m<ApiClient["returns"]>(["list", "create"]),
    writeOffs: m<ApiClient["writeOffs"]>(["list", "create"]),
    expenses: m<ApiClient["expenses"]>(["list", "create"]),
    photos: m<ApiClient["photos"]>(["list", "create"]),
    reports: m<ApiClient["reports"]>(["dashboard", "salesByDay", "salesBySalesman", "overdue", "lowStock"]),
    shopPortal: m<ApiClient["shopPortal"]>(["summary", "statement", "invoices", "invoice", "payments", "returns"]),
  };
}
