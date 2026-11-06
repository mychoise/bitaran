// DEV ONLY. A switch for checking error screens: while it is on, every mock call fails as if
// the server could not be reached. Kept for this browser tab only (sessionStorage).

export const SIMULATE_FAILURE_KEY = "bitaran:dev-only:simulate-failure";

const listeners = new Set<() => void>();

/** For useSyncExternalStore: told when the switch changes in this tab. */
export function subscribeFailure(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function failureSimulated(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(SIMULATE_FAILURE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFailureSimulated(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(SIMULATE_FAILURE_KEY, "1");
    else window.sessionStorage.removeItem(SIMULATE_FAILURE_KEY);
  } catch {
    // Storage blocked: the switch simply does nothing.
  }
  for (const l of listeners) l();
}
