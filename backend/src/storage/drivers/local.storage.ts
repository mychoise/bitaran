import { createReadStream } from 'node:fs';
import { mkdir, open, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { sniffImageMime } from '../image-signature.js';
import {
  assertValidKey,
  StorageNotFoundError,
  StorageService,
  StoredFile,
} from '../storage.service.js';

/**
 * Files on local disk under LOCAL_STORAGE_PATH, at the key's own path. For
 * development without Cloudinary. The mime type is read back from the file's
 * signature, so no metadata is kept beside it.
 */
export class LocalStorage extends StorageService {
  private readonly root: string;

  constructor(root: string) {
    super();
    this.root = resolve(root);
  }

  // The type is re-read from the file's signature, so `_mime` is not kept.
  async put(key: string, buffer: Buffer, _mime: string): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer, { flag: 'wx' }); // never overwrite
  }

  async get(key: string): Promise<StoredFile> {
    const path = this.pathOf(key);
    let head: Buffer;
    try {
      const fh = await open(path, 'r');
      try {
        head = Buffer.alloc(16);
        await fh.read(head, 0, 16, 0);
      } finally {
        await fh.close();
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new StorageNotFoundError(key);
      }
      throw err;
    }
    return {
      stream: createReadStream(path),
      mime: sniffImageMime(head) ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  private pathOf(key: string): string {
    assertValidKey(key); // also what keeps the path inside root
    return join(this.root, key);
  }
}
