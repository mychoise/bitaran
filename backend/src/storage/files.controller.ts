import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { IMAGE_MIMES } from './image-signature.js';
import { parseStorageKey } from './storage-key.js';
import { StorageNotFoundError, StorageService } from './storage.service.js';

const notFound = () =>
  new NotFoundException(errorBody('FILE_NOT_FOUND', 'File not found'));

@ApiTags('files')
@ApiBearerAuth()
@StaffOnly()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Streams a stored image to staff of the business that owns it (the key's
   * first segment). Always proxied: no storage URL ever reaches the client.
   */
  @Get('*key')
  @Header('Cache-Control', 'private, max-age=300')
  async get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('key') key: string | string[],
  ): Promise<StreamableFile> {
    const joined = Array.isArray(key) ? key.join('/') : key;
    const parsed = parseStorageKey(joined);
    if (!parsed) throw notFound();
    if (parsed.businessId !== user.businessId) {
      throw new ForbiddenException(
        errorBody('FORBIDDEN', 'This file belongs to another business'),
      );
    }

    try {
      const { stream, mime } = await this.storage.get(joined);
      // Never let a stored file be served as something a browser would run.
      const type = (IMAGE_MIMES as readonly string[]).includes(mime)
        ? mime
        : 'application/octet-stream';
      return new StreamableFile(stream, { type, disposition: 'inline' });
    } catch (err) {
      if (err instanceof StorageNotFoundError) throw notFound();
      throw err;
    }
  }
}
