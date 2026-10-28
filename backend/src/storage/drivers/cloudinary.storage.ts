import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import {
  assertValidKey,
  StorageNotFoundError,
  StorageService,
  StoredFile,
} from '../storage.service.js';

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// Every asset is uploaded, signed for and deleted with these. 'authenticated'
// means nothing is reachable without a signed URL: these images include
// cheques, PAN cards and payment screenshots. Never use type 'upload'.
const ASSET = { resource_type: 'image', type: 'authenticated' } as const;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Cloudinary storage. The key is the public_id (folders come from its
 * slashes). Reads go through a signed URL fetched here on the server; that
 * URL is never handed to a client, because Cloudinary's signed URLs do not
 * expire.
 */
export class CloudinaryStorage extends StorageService {
  constructor(credentials: CloudinaryCredentials) {
    super();
    if (process.env.NODE_ENV === 'test') {
      throw new Error('Tests must use STORAGE_DRIVER=memory, not Cloudinary');
    }
    // The SDK keeps this configuration globally. The secret is held only
    // there: it is never logged, and errors below carry Cloudinary's message,
    // which does not include it.
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    });
  }

  // Cloudinary detects the type from the bytes; `_mime` is not needed.
  put(key: string, buffer: Buffer, _mime: string): Promise<void> {
    assertValidKey(key);
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { ...ASSET, public_id: key, overwrite: false },
          (err, result?: UploadApiResponse) => {
            if (err || !result) {
              reject(
                new Error(
                  `Cloudinary upload failed: ${err?.message ?? 'no result'}`,
                ),
              );
            } else if (result.type !== 'authenticated') {
              // Belt and braces: an account preset must not make it public.
              reject(new Error(`Cloudinary stored ${key} as ${result.type}`));
            } else {
              resolve();
            }
          },
        )
        .end(buffer);
    });
  }

  async get(key: string): Promise<StoredFile> {
    assertValidKey(key);
    const url = cloudinary.url(key, { ...ASSET, sign_url: true, secure: true });
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) throw new StorageNotFoundError(key);
    if (!res.ok || !res.body) {
      // The URL is signed: keep it out of the error, and so out of the logs.
      throw new Error(`Cloudinary fetch for ${key} failed: HTTP ${res.status}`);
    }
    return {
      stream: Readable.fromWeb(res.body as WebReadableStream),
      mime: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    const result = (await cloudinary.uploader.destroy(key, {
      ...ASSET,
      invalidate: true,
    })) as { result?: string };
    // 'not found' is fine: the file is gone either way.
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary delete of ${key} failed: ${result.result}`);
    }
  }
}
