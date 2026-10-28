import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, max } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import { dayPlans, retailClients, visits } from '../database/schema/index.js';
import { ownPlan, visitColumns } from './day-plans.service.js';
import { AddVisitDto, UpdateVisitDto } from './dto/visit.dto.js';

const fail = {
  visitNotFound: () =>
    new NotFoundException(errorBody('VISIT_NOT_FOUND', 'Visit not found')),
  planNotFound: () =>
    new NotFoundException(
      errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
    ),
  notInProgress: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_IN_PROGRESS',
        `Visits can only be changed while the day is in progress; this plan is ${status}`,
      ),
    ),
  clientNotFound: () =>
    new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found')),
  clientInactive: () =>
    new ConflictException(
      errorBody('CLIENT_INACTIVE', 'This shop is deactivated'),
    ),
  duplicate: () =>
    new ConflictException(
      errorBody('VISIT_EXISTS', 'This shop is already on today’s plan'),
    ),
};

/** Visits are worked only by the plan's own salesman, while it is in progress. */
@Injectable()
export class VisitsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async update(actor: StaffTokenPayload, visitId: string, dto: UpdateVisitDto) {
    return withTransaction(this.db, async (tx) => {
      // Lock the plan so it cannot be closed while this visit changes.
      const [found] = await tx
        .select({ planId: dayPlans.id, status: dayPlans.status })
        .from(visits)
        .innerJoin(dayPlans, eq(dayPlans.id, visits.dayPlanId))
        .where(
          and(
            eq(visits.id, visitId),
            eq(dayPlans.businessId, actor.businessId),
            eq(dayPlans.salesmanId, actor.sub),
          ),
        )
        .for('update', { of: dayPlans });
      // Another salesman's visit is reported as missing.
      if (!found) throw fail.visitNotFound();
      if (found.status !== 'in_progress') {
        throw fail.notInProgress(found.status);
      }

      const [current] = await tx
        .select({ status: visits.status, visitedAt: visits.visitedAt })
        .from(visits)
        .where(eq(visits.id, visitId));
      await tx
        .update(visits)
        .set({
          status: dto.status,
          // Server clock only. Re-marking a visited shop keeps the first time;
          // a skipped shop has no visit time.
          visitedAt:
            dto.status === 'skipped'
              ? null
              : current.status === 'visited'
                ? current.visitedAt
                : new Date(),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.lat !== undefined && { lat: dto.lat, lng: dto.lng }),
        })
        .where(eq(visits.id, visitId));
      return this.getVisit(tx, visitId);
    });
  }

  /** Adds a shop that is not on the route (or was left off) to a running day. */
  async add(actor: StaffTokenPayload, planId: string, dto: AddVisitDto) {
    return withTransaction(this.db, async (tx) => {
      // The lock also serialises sequence numbering for concurrent adds.
      const [plan] = await tx
        .select({ status: dayPlans.status })
        .from(dayPlans)
        .where(ownPlan(actor, planId))
        .for('update');
      if (!plan) throw fail.planNotFound();
      if (plan.status !== 'in_progress') throw fail.notInProgress(plan.status);

      const [client] = await tx
        .select({ isActive: retailClients.isActive })
        .from(retailClients)
        .where(
          and(
            eq(retailClients.id, dto.clientId),
            eq(retailClients.businessId, actor.businessId),
          ),
        );
      if (!client) throw fail.clientNotFound();
      if (!client.isActive) throw fail.clientInactive();

      const [{ last }] = await tx
        .select({ last: max(visits.sequence) })
        .from(visits)
        .where(eq(visits.dayPlanId, planId));
      const id = randomUUID();
      try {
        await tx.insert(visits).values({
          id,
          dayPlanId: planId,
          clientId: dto.clientId,
          sequence: last === null ? 0 : last + 1,
        });
      } catch (err) {
        if (isUniqueViolation(err, 'idx_visits_day_plan_client')) {
          throw fail.duplicate();
        }
        throw err;
      }
      return this.getVisit(tx, id);
    });
  }

  private async getVisit(tx: Transaction, id: string) {
    const [row] = await tx
      .select({ ...visitColumns, dayPlanId: visits.dayPlanId })
      .from(visits)
      .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
      .where(eq(visits.id, id));
    return row;
  }
}
