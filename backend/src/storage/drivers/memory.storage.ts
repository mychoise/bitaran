import { Readable } from 'node:stream';
import {
  assertValidKey,
  StorageNotFoundError,
  StorageService,
  StoredFile,
} from '../storage.service.js';

/** In-process storage for tests. Contents vanish with the process. */
export class MemoryStorage extends StorageService {
  readonly files = new Map<string, { buffer: Buffer; mime: string }>();

  async put(key: string, buffer: Buffer, mime: string): Promise<void> {
    assertValidKey(key);
    this.files.set(key, { buffer: Buffer.from(buffer), mime });
  }

  async get(key: string): Promise<StoredFile> {
    assertValidKey(key);
    const file = this.files.get(key);
    if (!file) throw new StorageNotFoundError(key);
    return { stream: Readable.from([file.buffer]), mime: file.mime };
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    this.files.delete(key);
  }
}
