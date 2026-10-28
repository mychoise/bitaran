import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { DatabaseModule } from './database.module.js';

/** Minimal module for CLI scripts (migrate, seed): validated config + Drizzle. */
@Module({ imports: [AppConfigModule, DatabaseModule] })
export class DatabaseCliModule {}
