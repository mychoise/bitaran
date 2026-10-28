import { ConflictException, NotFoundException } from '@nestjs/common';
import { and, eq, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import type { Database, Transaction } from '../database/database.types.js';
import { dayPlans } from '../database/schema/index.js';

type PlanStatus = (typeof dayPlans.$inferSelect)['status'];

/**
 * The plan something collected on the road (a payment, a return, a
 * write-off) is recorded against.
 *
 * - Salesmen: always their own plan, which must be in progress; `dayPlanId`
 *   defaults to their running one.
 * - Managers/owners: the plan named, if any (any of the business's plans,
 *   unless `managerStatuses` limits it); none if not named.
 *
 * With `lock`, the plan row is locked (`share` lets several records be added
 * at once while still blocking a concurrent close).
 */
export async function workingPlan(
  executor: Database | Transaction,
  actor: StaffTokenPayload,
  dayPlanId: string | undefined,
  opts: {
    lock?: 'share' | 'update';
    managerStatuses?: PlanStatus[];
    what: string;
  },
): Promise<{ id: string; status: PlanStatus } | null> {
  const isSalesman = actor.role === 'salesman';
  if (!isSalesman && !dayPlanId) return null;

  const scope: SQL[] = [eq(dayPlans.businessId, actor.businessId)];
  if (isSalesman) scope.push(eq(dayPlans.salesmanId, actor.sub));
  if (dayPlanId) scope.push(eq(dayPlans.id, dayPlanId));
  else scope.push(eq(dayPlans.status, 'in_progress'));

  const q = executor
    .select({ id: dayPlans.id, status: dayPlans.status })
    .from(dayPlans)
    .where(and(...scope));
  const [plan] = await (opts.lock ? q.for(opts.lock) : q);
  if (!plan) {
    throw dayPlanId
      ? new NotFoundException(
          errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
        )
      : new ConflictException(
          errorBody(
            'NO_DAY_IN_PROGRESS',
            `Start your day before recording ${opts.what}`,
          ),
        );
  }
  const allowed = isSalesman ? ['in_progress'] : opts.managerStatuses;
  if (allowed && !allowed.includes(plan.status)) {
    throw new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_IN_PROGRESS',
        `${opts.what[0].toUpperCase()}${opts.what.slice(1)} cannot be recorded on this plan; it is ${plan.status}`,
      ),
    );
  }
  return plan;
}
