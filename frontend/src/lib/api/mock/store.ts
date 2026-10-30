// DEV ONLY. The demo data lives in this browser's localStorage under one dev-only key.
// It is mock data for reviewing screens, nothing else. The login session is never stored here:
// it stays in the httpOnly cookie set by the login pages.

import { DEMO_DATA_VERSION, seedDemoData, type DemoData } from "./seed.ts";

export const DEMO_STORAGE_KEY = "bitaran:dev-only:demo-data";

let cache: DemoData | null = null;

function read(): DemoData | null {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DemoData;
    return data.version === DEMO_DATA_VERSION ? data : null;
  } catch {
    return null; // private window, blocked storage or a damaged value: start again from the seed
  }
}

/** The demo data, loaded once per page and seeded on first use. */
export function getData(): DemoData {
  if (!cache) {
    cache = read() ?? seedDemoData();
    save();
  }
  return cache;
}

/** Saves after a change. Failure to save (full or blocked storage) only loses persistence. */
export function save(): void {
  if (!cache) return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* keep working in memory */
  }
}

/** Throws the demo data away and seeds it again from today. */
export function resetDemoData(): void {
  cache = seedDemoData();
  save();
}
