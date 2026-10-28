import { randomUUID } from 'node:crypto';

/** What a stored file is for. The second segment of every key. */
export const STORAGE_CATEGORIES = [
  'visit-photos',
  'payment-images',
  'expense-receipts',
  'pan-cards',
  'product-images',
  'logos',
] as const;
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number];

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(
  `^(${UUID})/(${STORAGE_CATEGORIES.join('|')})/(${UUID})$`,
);

export interface StorageKey {
  businessId: string;
  category: StorageCategory;
  id: string;
}

/**
 * A new key: {businessId}/{category}/{uuid}, no file extension. This is the
 * only thing the database stores (in the *_key columns), never a URL.
 */
export function newStorageKey(
  businessId: string,
  category: StorageCategory,
): string {
  const key = `${businessId}/${category}/${randomUUID()}`;
  if (!KEY.test(key)) throw new TypeError(`Invalid businessId: ${businessId}`);
  return key;
}

/**
 * Parses a key, or returns null if it is not exactly in our format. Every
 * driver refuses anything else, which also rules out path traversal.
 */
export function parseStorageKey(key: string): StorageKey | null {
  const m = KEY.exec(key);
  return m
    ? { businessId: m[1], category: m[2] as StorageCategory, id: m[3] }
    : null;
}
