import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DbModule } from '../../db/db.module';

@Global()
@Module({
  imports: [DbModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
