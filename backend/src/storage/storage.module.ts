import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../config/app-config.module.js';
import { CloudinaryStorage } from './drivers/cloudinary.storage.js';
import { LocalStorage } from './drivers/local.storage.js';
import { MemoryStorage } from './drivers/memory.storage.js';
import { FilesController } from './files.controller.js';
import { ImageService } from './image.service.js';
import { StorageService } from './storage.service.js';

/** Builds the driver STORAGE_DRIVER names. */
export function createStorage(config: AppConfigService): StorageService {
  switch (config.get('STORAGE_DRIVER', { infer: true })) {
    case 'cloudinary':
      return new CloudinaryStorage({
        cloudName: config.get('CLOUDINARY_CLOUD_NAME', { infer: true })!,
        apiKey: config.get('CLOUDINARY_API_KEY', { infer: true })!,
        apiSecret: config.get('CLOUDINARY_API_SECRET', { infer: true })!,
      });
    case 'local':
      return new LocalStorage(
        config.get('LOCAL_STORAGE_PATH', { infer: true }),
      );
    case 'memory':
      return new MemoryStorage();
  }
}

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: createStorage,
    },
    ImageService,
  ],
  exports: [StorageService, ImageService],
})
export class StorageModule {}
