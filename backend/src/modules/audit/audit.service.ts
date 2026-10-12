import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import { auditLogs } from '../../db/schema';

export interface AuditLogParams {
  actorId?: string | null;
  orgId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        actorId: params.actorId || null,
        orgId: params.orgId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        meta: params.meta || null,
      });
    } catch (err) {
      console.error('Failed to insert audit log:', err);
    }
  }
}
