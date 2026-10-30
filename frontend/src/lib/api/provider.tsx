"use client";

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ApiError, type ApiClient } from "./client";
import { createHttpClient } from "./http";
import type { Viewer } from "./types";

export type ApiMode = "mock" | "api";

type ApiContextValue = { mode: ApiMode; viewer: Viewer; getClient: () => Promise<ApiClient> };
const ApiContext = createContext<ApiContextValue | null>(null);

/**
 * React Query and the ApiClient for one signed-in person. The mode comes from the server's
 * API_MODE; the mock (and its demo data) is only downloaded when the mode is "mock".
 */
export function ApiProvider({ mode, viewer, children }: { mode: ApiMode; viewer: Viewer; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  const value = useMemo<ApiContextValue>(() => {
    let client: Promise<ApiClient> | null = null;
    const getClient = () =>
      (client ??= mode === "mock" ? import("./mock").then((m) => m.createMockClient(viewer)) : Promise.resolve(createHttpClient(viewer)));
    return { mode, viewer, getClient };
  }, [mode, viewer]);
  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi must be used inside ApiProvider");
  return ctx;
}

/** A React Query query against the ApiClient. Keys are scoped to the viewer. */
export function useApiQuery<T>(key: QueryKey, run: (api: ApiClient) => Promise<T>, options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">) {
  const { viewer, getClient } = useApi();
  return useQuery<T, Error>({ queryKey: [viewer.id, ...key], queryFn: async () => run(await getClient()), ...options });
}

/**
 * A change through the ApiClient. On success, every query under each `invalidates` prefix is
 * refetched, so lists, details and headers show the new values.
 */
export function useApiMutation<TInput, TResult>(run: (api: ApiClient, input: TInput) => Promise<TResult>, invalidates: QueryKey[] = []) {
  const { viewer, getClient } = useApi();
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TInput>({
    mutationFn: async (input) => run(await getClient(), input),
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [viewer.id, ...key] }))),
  });
}

/** Plain words for any failure. Raw codes never reach the screen. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "unreachable") return err.message === "Backend not connected yet" ? "The backend is not connected yet." : "We could not reach the server. Please try again.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
