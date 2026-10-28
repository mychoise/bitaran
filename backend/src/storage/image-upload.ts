import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  PipeTransform,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { createHash } from 'node:crypto';
import { catchError, Observable } from 'rxjs';
import sharp from 'sharp';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { UploadThrottle } from '../common/throttle.js';
import { ImageMime, sniffImageMime } from './image-signature.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  mime: ImageMime;
  /** Of the bytes as received, before any stamping. */
  sha256: string;
}

const tooLarge = () =>
  new PayloadTooLargeException(
    errorBody('FILE_TOO_LARGE', 'Images must be 10 MB or smaller'),
  );

// sharp's format names for the types we accept.
const SHARP_FORMAT: Record<ImageMime, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Checks an uploaded image and returns { buffer, mime, sha256 }. Accepts only
 * JPEG, PNG and WebP, judged by the file's signature (never its name or
 * claimed type) and confirmed by decoding the header, up to 10 MB.
 */
export async function validateImage(
  buffer: Buffer | undefined,
): Promise<UploadedImage> {
  if (!buffer?.length) {
    throw new BadRequestException(
      errorBody('FILE_REQUIRED', 'An image file is required'),
    );
  }
  if (buffer.length > MAX_IMAGE_BYTES) throw tooLarge();

  const mime = sniffImageMime(buffer);
  if (!mime) {
    throw new UnsupportedMediaTypeException(
      errorBody(
        'UNSUPPORTED_FILE_TYPE',
        'Only JPEG, PNG and WebP images are accepted',
      ),
    );
  }
  // A valid signature on a file that does not decode (truncated, or another
  // format wearing an image header) is rejected too.
  const format = await sharp(buffer)
    .metadata()
    .then((m) => m.format as string | undefined)
    .catch(() => undefined);
  if (format !== SHARP_FORMAT[mime]) {
    throw new UnprocessableEntityException(
      errorBody('IMAGE_UNREADABLE', 'The image could not be read'),
    );
  }

  return {
    buffer,
    mime,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Use as @UploadedFile(ParseImagePipe) after @ImageUpload(). */
@Injectable()
export class ParseImagePipe implements PipeTransform<
  Express.Multer.File | undefined,
  Promise<UploadedImage>
> {
  transform(file: Express.Multer.File | undefined): Promise<UploadedImage> {
    return validateImage(file?.buffer);
  }
}

/** Multer's own size error, re-stated in our error format. */
@Injectable()
class UploadErrorsInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        throw err instanceof PayloadTooLargeException ? tooLarge() : err;
      }),
    );
  }
}

/** Text fields alongside the files: how many, and how long each may be. */
const FIELD_LIMITS = { fields: 30, fieldSize: 16 * 1024 };

/**
 * Accepts one multipart image in `field`, held in memory. Multer stops
 * reading past the size limit, so an oversized upload is never fully buffered.
 * Throttled per user (UPLOAD_THROTTLE), checked before anything is read.
 */
export const ImageUpload = (field = 'file') =>
  applyDecorators(
    UploadThrottle(),
    UseInterceptors(
      UploadErrorsInterceptor,
      FileInterceptor(field, {
        limits: { ...FIELD_LIMITS, fileSize: MAX_IMAGE_BYTES, files: 1 },
      }),
    ),
  );

/**
 * Accepts several multipart images, one form field per kind (the field name
 * says what the image is). Pair with @UploadedFiles() and validate each file
 * with validateImage().
 */
export const ImagesUpload = (fields: { name: string; maxCount: number }[]) =>
  applyDecorators(
    UploadThrottle(),
    UseInterceptors(
      UploadErrorsInterceptor,
      FileFieldsInterceptor(fields, {
        limits: {
          ...FIELD_LIMITS,
          fileSize: MAX_IMAGE_BYTES,
          files: fields.reduce((n, f) => n + f.maxCount, 0),
        },
      }),
    ),
  );
