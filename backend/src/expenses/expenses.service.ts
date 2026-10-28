import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, SQL, sql, sum } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { nepalToday } from '../common/utils/date.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { dayPlans, expenses, users } from '../database/schema/index.js';
import { ImageService } from '../storage/image.service.js';
import { validateImage } from '../storage/image-upload.js';
import { newStorageKey } from '../storage/storage-key.js';
import { StorageService } from '../storage/storage.service.js';
import {
  CreateExpenseDto,
  EXPENSE_TYPES,
  ExpenseSummaryQueryDto,
  ExpenseType,
  ListExpensesQueryDto,
  SALESMAN_EXPENSE_TYPES,
  UpdateExpenseDto,
} from './dto/expense.dto.js';

const fail = {
  notFound: () =>
    new NotFoundException(errorBody('EXPENSE_NOT_FOUND', 'Expense not found')),
  userNotFound: () =>
    new NotFoundException(
      errorBody('USER_NOT_FOUND', 'Staff member not found'),
    ),
  planNotFound: () =>
    new NotFoundException(
      errorBody('DAY_PLAN_NOT_FOUND', 'Day plan not found'),
    ),
  userRequired: () =>
    new BadRequestException(
      errorBody('USER_REQUIRED', 'A salary expense needs userId'),
    ),
  salaryManagersOnly: () =>
    new ForbiddenException(
      errorBody(
        'EXPENSE_TYPE_NOT_ALLOWED',
        'Salesmen may record only fuel, khaja and miscellaneous expenses',
      ),
    ),
  ownOnly: () =>
    new ForbiddenException(
      errorBody(
        'FIELD_NOT_ALLOWED',
        'Salesmen may record expenses only for themselves',
      ),
    ),
  forMonthSalaryOnly: () =>
    new BadRequestException(
      errorBody('FIELD_NOT_ALLOWED', 'forMonth is only for salary expenses'),
    ),
  planUserMismatch: () =>
    new BadRequestException(
      errorBody(
        'DAY_PLAN_USER_MISMATCH',
        'The day plan must belong to the expense’s staff member',
      ),
    ),
  futureDate: () =>
    new BadRequestException(
      errorBody('DATE_IN_FUTURE', 'expenseDate cannot be in the future'),
    ),
  badRange: () =>
    new BadRequestException(
      errorBody('INVALID_DATE_RANGE', '`from` must not be after `to`'),
    ),
};

const recorder = alias(users, 'recorder');

/** for_month is stored as the first day of the month. */
const salaryMonthOf = (date: string) => `${date.slice(0, 7)}-01`;

const expenseColumns = {
  id: expenses.id,
  type: expenses.type,
  amountPaisa: expenses.amountPaisa,
  expenseDate: expenses.expenseDate,
  forMonth: expenses.forMonth,
  description: expenses.description,
  receiptKey: expenses.receiptKey,
  dayPlanId: expenses.dayPlanId,
  userId: expenses.userId,
  user: { id: users.id, fullName: users.fullName },
  recordedBy: { id: recorder.id, fullName: recorder.fullName },
  createdAt: expenses.createdAt,
};

/** The fields that must agree with each other, after a create or edit. */
interface ExpenseShape {
  type: ExpenseType;
  expenseDate: string;
  userId: string | null;
  dayPlanId: string | null;
  forMonth: string | null;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  // ---------- reads ----------

  /** Salesmen see only expenses recorded against themselves. */
  async list(actor: StaffTokenPayload, query: ListExpensesQueryDto) {
    if (query.from && query.to && query.from > query.to) throw fail.badRange();
    const filters = this.scope(actor, query.userId);
    if (query.type) filters.push(eq(expenses.type, query.type));
    if (query.from) filters.push(sql`${expenses.expenseDate} >= ${query.from}`);
    if (query.to) filters.push(sql`${expenses.expenseDate} <= ${query.to}`);
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(expenseColumns)
        .from(expenses)
        .leftJoin(users, eq(users.id, expenses.userId))
        .innerJoin(recorder, eq(recorder.id, expenses.recordedBy))
        .where(where)
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(expenses).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /**
   * Totals between two expense dates (inclusive), by type and by calendar
   * month of the expense date (Gregorian, as all dates here). Every type is
   * listed, with zero where nothing was spent. Salesmen: their own only.
   */
  async summary(actor: StaffTokenPayload, query: ExpenseSummaryQueryDto) {
    if (query.from > query.to) throw fail.badRange();
    const month = sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`;
    const where = and(
      ...this.scope(actor),
      sql`${expenses.expenseDate} >= ${query.from}`,
      sql`${expenses.expenseDate} <= ${query.to}`,
    );
    const rows = await this.db
      .select({
        month,
        type: expenses.type,
        totalPaisa: sum(expenses.amountPaisa).mapWith(Number),
        count: count(),
      })
      .from(expenses)
      .where(where)
      .groupBy(month, expenses.type)
      .orderBy(month);

    const zero = () =>
      Object.fromEntries(EXPENSE_TYPES.map((t) => [t, 0])) as Record<
        ExpenseType,
        number
      >;
    const byType = EXPENSE_TYPES.map((type) => ({
      type,
      totalPaisa: 0,
      count: 0,
    }));
    const months = new Map<
      string,
      { month: string; totalPaisa: number; byType: Record<ExpenseType, number> }
    >();
    for (const r of rows) {
      const t = byType.find((b) => b.type === r.type)!;
      t.totalPaisa += r.totalPaisa;
      t.count += r.count;
      let m = months.get(r.month);
      if (!m) {
        m = { month: r.month, totalPaisa: 0, byType: zero() };
        months.set(r.month, m);
      }
      m.totalPaisa += r.totalPaisa;
      m.byType[r.type] += r.totalPaisa;
    }
    return {
      from: query.from,
      to: query.to,
      totalPaisa: byType.reduce((n, t) => n + t.totalPaisa, 0),
      byType,
      byMonth: [...months.values()],
    };
  }

  // ---------- writes ----------

  /**
   * Records an expense, with an optional receipt image. Everything is checked
   * before the receipt is stored; if the insert then fails, it is deleted.
   */
  async create(
    actor: StaffTokenPayload,
    dto: CreateExpenseDto,
    receipt: Express.Multer.File | undefined,
  ) {
    if (actor.role === 'salesman') {
      if (!SALESMAN_EXPENSE_TYPES.includes(dto.type)) {
        throw fail.salaryManagersOnly();
      }
      if (dto.userId && dto.userId !== actor.sub) throw fail.ownOnly();
    }
    if (dto.forMonth && dto.type !== 'salary') throw fail.forMonthSalaryOnly();
    const expenseDate = dto.expenseDate ?? nepalToday();
    const shape: ExpenseShape = {
      type: dto.type,
      expenseDate,
      userId: dto.userId ?? (actor.role === 'salesman' ? actor.sub : null),
      dayPlanId: dto.dayPlanId ?? null,
      forMonth: dto.forMonth
        ? `${dto.forMonth}-01`
        : dto.type === 'salary'
          ? salaryMonthOf(expenseDate)
          : null,
    };
    await this.assertConsistent(actor, shape);
    const image = receipt ? await validateImage(receipt.buffer) : undefined;

    const id = randomUUID();
    const createdAt = new Date();
    let receiptKey: string | null = null;
    try {
      if (image) {
        receiptKey = newStorageKey(actor.businessId, 'expense-receipts');
        const stamped = await this.images.stampDate(image.buffer, createdAt);
        await this.storage.put(receiptKey, stamped, image.mime);
      }
      await this.db.insert(expenses).values({
        id,
        businessId: actor.businessId,
        ...shape,
        amountPaisa: dto.amountPaisa,
        description: dto.description,
        receiptKey,
        recordedBy: actor.sub,
        createdAt,
      });
    } catch (err) {
      if (receiptKey) {
        const key = receiptKey;
        await this.storage.delete(key).catch((e: unknown) => {
          this.logger.warn({ err: e, key }, 'Could not delete orphaned upload');
        });
      }
      throw err;
    }
    return this.get(actor, id);
  }

  /**
   * Managers and owners correct an expense in place.
   *
   * NOTE: there is no edit history. The row is overwritten and the previous
   * values are lost; nothing records who changed what, or when. If an audit
   * trail is needed, it needs its own table.
   */
  async update(actor: StaffTokenPayload, id: string, dto: UpdateExpenseDto) {
    const [current] = await this.db
      .select({
        type: expenses.type,
        expenseDate: expenses.expenseDate,
        userId: expenses.userId,
        dayPlanId: expenses.dayPlanId,
        forMonth: expenses.forMonth,
      })
      .from(expenses)
      .where(
        and(eq(expenses.id, id), eq(expenses.businessId, actor.businessId)),
      );
    if (!current) throw fail.notFound();

    const type = dto.type ?? current.type;
    const expenseDate = dto.expenseDate ?? current.expenseDate;
    if (dto.forMonth && type !== 'salary') throw fail.forMonthSalaryOnly();
    let forMonth =
      dto.forMonth === undefined
        ? current.forMonth
        : dto.forMonth && `${dto.forMonth}-01`;
    // A salary always has a month; anything else (say, a salary re-typed as
    // fuel) never does.
    if (type !== 'salary') forMonth = null;
    else forMonth ??= salaryMonthOf(expenseDate);
    const shape: ExpenseShape = {
      type,
      expenseDate,
      userId: dto.userId === undefined ? current.userId : dto.userId,
      dayPlanId:
        dto.dayPlanId === undefined ? current.dayPlanId : dto.dayPlanId,
      forMonth,
    };
    await this.assertConsistent(actor, shape);

    await this.db
      .update(expenses)
      .set({
        ...shape,
        ...(dto.amountPaisa !== undefined && { amountPaisa: dto.amountPaisa }),
        ...(dto.description !== undefined && { description: dto.description }),
      })
      .where(
        and(eq(expenses.id, id), eq(expenses.businessId, actor.businessId)),
      );
    return this.get(actor, id);
  }

  // ---------- helpers ----------

  private async get(actor: StaffTokenPayload, id: string) {
    const [row] = await this.db
      .select(expenseColumns)
      .from(expenses)
      .leftJoin(users, eq(users.id, expenses.userId))
      .innerJoin(recorder, eq(recorder.id, expenses.recordedBy))
      .where(and(eq(expenses.id, id), ...this.scope(actor)));
    if (!row) throw fail.notFound();
    return row;
  }

  /** The business, and for salesmen only their own expenses. */
  private scope(actor: StaffTokenPayload, userId?: string): SQL[] {
    const filters: SQL[] = [eq(expenses.businessId, actor.businessId)];
    if (actor.role === 'salesman') filters.push(eq(expenses.userId, actor.sub));
    else if (userId) filters.push(eq(expenses.userId, userId));
    return filters;
  }

  /** Salary names a person; the user and plan are this business's and agree. */
  private async assertConsistent(
    actor: StaffTokenPayload,
    shape: ExpenseShape,
  ): Promise<void> {
    if (shape.type === 'salary' && !shape.userId) throw fail.userRequired();
    if (shape.expenseDate > nepalToday()) throw fail.futureDate();
    if (shape.userId) {
      const [user] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, shape.userId),
            eq(users.businessId, actor.businessId),
          ),
        );
      if (!user) throw fail.userNotFound();
    }
    if (shape.dayPlanId) {
      const [plan] = await this.db
        .select({ salesmanId: dayPlans.salesmanId })
        .from(dayPlans)
        .where(
          and(
            eq(dayPlans.id, shape.dayPlanId),
            eq(dayPlans.businessId, actor.businessId),
          ),
        );
      if (!plan) throw fail.planNotFound();
      if (plan.salesmanId !== shape.userId) throw fail.planUserMismatch();
    }
  }
}
