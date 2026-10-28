import { Readable } from 'node:stream';
import { parseStorageKey } from './storage-key.js';

export interface StoredFile {
  stream: Readable;
  mime: string;
}

/** Thrown by get() when nothing is stored under the key. */
export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`No file stored under ${key}`);
  }
}

/**
 * File storage, by key (see storage-key.ts). Also the DI token: inject
 * StorageService and STORAGE_DRIVER picks the implementation.
 */
export abstract class StorageService {
  abstract put(key: string, buffer: Buffer, mime: string): Promise<void>;
  abstract get(key: string): Promise<StoredFile>;
  /** Removes the file. Deleting a missing key is not an error. */
  abstract delete(key: string): Promise<void>;
}

/** Throws unless `key` is in our format. Drivers call this first. */
export function assertValidKey(key: string): void {
  if (!parseStorageKey(key)) throw new TypeError(`Invalid storage key: ${key}`);
}
