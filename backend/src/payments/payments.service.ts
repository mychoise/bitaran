import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, SQL, sql } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  paymentImages,
  payments,
  retailClients,
  sales,
  users,
} from '../database/schema/index.js';
import { workingPlan } from '../day-plans/working-plan.js';
import { ImageService } from '../storage/image.service.js';
import { validateImage } from '../storage/image-upload.js';
import type { UploadedImage } from '../storage/image-upload.js';
import { newStorageKey } from '../storage/storage-key.js';
import { StorageService } from '../storage/storage.service.js';
import {
  CreatePaymentDto,
  IMAGE_FIELDS,
  ImageKind,
  KINDS_FOR,
  ListPaymentsQueryDto,
} from './dto/payment.dto.js';

/** Uploaded files by form field (= image kind), as multer gives them. */
export type PaymentFiles = Partial<Record<ImageKind, Express.Multer.File[]>>;

const fail = {
  notFound: () =>
    new NotFoundException(errorBody('PAYMENT_NOT_FOUND', 'Payment not found')),
  proofRequired: (method: string) =>
    new BadRequestException(
      errorBody(
        'PROOF_REQUIRED',
        `A ${method} payment needs at least one image as proof`,
      ),
    ),
  chequeNumberRequired: () =>
    new BadRequestException(
      errorBody(
        'CHEQUE_NUMBER_REQUIRED',
        'A cheque payment needs chequeNumber',
      ),
    ),
  chequeFieldsNotAllowed: () =>
    new BadRequestException(
      errorBody(
        'FIELD_NOT_ALLOWED',
        'chequeNumber, chequeBank and chequeDate are only for cheque payments',
      ),
    ),
  kindNotAllowed: (kind: string, method: string, allowed: string[]) =>
    new BadRequestException(
      errorBody(
        'IMAGE_KIND_NOT_ALLOWED',
        `A ${method} payment cannot carry a ${kind} image; use ${allowed.join(' or ')}`,
      ),
    ),
  duplicateImage: () =>
    new ConflictException(
      errorBody(
        'DUPLICATE_IMAGE',
        'This image was already used as proof for a payment; the same proof cannot back two payments',
      ),
    ),
  clientNotFound: () =>
    new NotFoundException(errorBody('CLIENT_NOT_FOUND', 'Shop not found')),
  saleNotFound: () =>
    new NotFoundException(errorBody('SALE_NOT_FOUND', 'Sale not found')),
  saleMismatch: () =>
    new UnprocessableEntityException(
      errorBody('SALE_MISMATCH', 'saleId must be a sale to the same shop'),
    ),
  saleCancelled: () =>
    new ConflictException(
      errorBody('SALE_CANCELLED', 'This sale is cancelled'),
    ),
  idempotencyConflict: () =>
    new ConflictException(
      errorBody(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different payment',
      ),
    ),
  statusFinal: (status: string) =>
    new ConflictException(
      errorBody(
        'PAYMENT_STATUS_FINAL',
        `This payment is already ${status} and cannot be changed`,
      ),
    ),
};

const paymentColumns = {
  id: payments.id,
  method: payments.method,
  status: payments.status,
  amountPaisa: payments.amountPaisa,
  receivedAt: payments.receivedAt,
  saleId: payments.saleId,
  dayPlanId: payments.dayPlanId,
  chequeNumber: payments.chequeNumber,
  chequeBank: payments.chequeBank,
  chequeDate: payments.chequeDate,
  referenceNo: payments.referenceNo,
  note: payments.note,
  createdAt: payments.createdAt,
  client: { id: retailClients.id, name: retailClients.name },
  collectedBy: { id: users.id, fullName: users.fullName },
};

export interface CreatePaymentResult {
  payment: Awaited<ReturnType<PaymentsService['get']>>;
  replayed: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  // ---------- reads ----------

  async list(actor: StaffTokenPayload, query: ListPaymentsQueryDto) {
    const filters: SQL[] = [eq(payments.businessId, actor.businessId)];
    if (actor.role === 'salesman') {
      filters.push(eq(payments.collectedBy, actor.sub));
    } else if (query.collectedBy) {
      filters.push(eq(payments.collectedBy, query.collectedBy));
    }
    if (query.clientId) filters.push(eq(payments.clientId, query.clientId));
    if (query.dayPlanId) filters.push(eq(payments.dayPlanId, query.dayPlanId));
    if (query.saleId) filters.push(eq(payments.saleId, query.saleId));
    if (query.method) filters.push(eq(payments.method, query.method));
    if (query.status) filters.push(eq(payments.status, query.status));
    // Dates are Nepal calendar days of when the money was received.
    const receivedOn = sql`(${payments.receivedAt} at time zone 'Asia/Kathmandu')::date`;
    if (query.from) filters.push(sql`${receivedOn} >= ${query.from}`);
    if (query.to) filters.push(sql`${receivedOn} <= ${query.to}`);
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(paymentColumns)
        .from(payments)
        .innerJoin(retailClients, eq(retailClients.id, payments.clientId))
        .innerJoin(users, eq(users.id, payments.collectedBy))
        .where(where)
        .orderBy(desc(payments.receivedAt), desc(payments.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db.select({ total: count() }).from(payments).where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /** A payment with its proof images. Salesmen: ones they collected only. */
  async get(actor: StaffTokenPayload, id: string) {
    const own =
      actor.role === 'salesman'
        ? eq(payments.collectedBy, actor.sub)
        : undefined;
    const [payment] = await this.db
      .select(paymentColumns)
      .from(payments)
      .innerJoin(retailClients, eq(retailClients.id, payments.clientId))
      .innerJoin(users, eq(users.id, payments.collectedBy))
      .where(
        and(
          eq(payments.id, id),
          eq(payments.businessId, actor.businessId),
          own,
        ),
      );
    if (!payment) throw fail.notFound();
    const images = await this.db
      .select({
        id: paymentImages.id,
        kind: paymentImages.kind,
        imageKey: paymentImages.imageKey,
        imageHash: paymentImages.imageHash,
        uploadedAt: paymentImages.uploadedAt,
      })
      .from(paymentImages)
      .where(eq(paymentImages.paymentId, id))
      .orderBy(paymentImages.kind, paymentImages.uploadedAt);
    return { ...payment, images };
  }

  // ---------- create ----------

  /**
   * Records a payment with its proof. Everything is checked before any image
   * is uploaded; the images are then stamped and stored, and the payment and
   * its image rows are written in one transaction. If that transaction
   * fails, the uploaded files are deleted again.
   */
  async create(
    actor: StaffTokenPayload,
    dto: CreatePaymentDto,
    files: PaymentFiles,
    idempotencyKey: string,
  ): Promise<CreatePaymentResult> {
    const replay = await this.findReplay(actor, dto, idempotencyKey);
    if (replay) return replay;

    const proofs = await checkProofs(dto, files);
    await this.assertImagesUnused(proofs.map((p) => p.sha256));
    await this.resolveContext(this.db, actor, dto); // fail before uploading

    const receivedAt = new Date();
    const stored: { kind: ImageKind; key: string; sha256: string }[] = [];
    try {
      for (const proof of proofs) {
        const key = newStorageKey(actor.businessId, 'payment-images');
        const stamped = await this.images.stampDate(proof.buffer, receivedAt);
        await this.storage.put(key, stamped, proof.mime);
        stored.push({ kind: proof.kind, key, sha256: proof.sha256 });
      }

      const id = await withTransaction(this.db, async (tx) => {
        const ctx = await this.resolveContext(tx, actor, dto, { lock: true });
        const paymentId = randomUUID();
        await tx.insert(payments).values({
          id: paymentId,
          businessId: actor.businessId,
          clientId: dto.clientId,
          saleId: dto.saleId,
          dayPlanId: ctx.dayPlanId,
          collectedBy: actor.sub,
          method: dto.method,
          // Cash is in hand. Cheques and transfers wait for a manager to see
          // the money arrive.
          status: dto.method === 'cash' ? 'confirmed' : 'pending',
          amountPaisa: dto.amountPaisa,
          receivedAt,
          chequeNumber: dto.chequeNumber,
          chequeBank: dto.chequeBank,
          chequeDate: dto.chequeDate,
          referenceNo: dto.referenceNo,
          note: dto.note,
          idempotencyKey,
          createdAt: receivedAt,
        });
        if (stored.length) {
          await tx.insert(paymentImages).values(
            stored.map((s) => ({
              id: randomUUID(),
              paymentId,
              kind: s.kind,
              imageKey: s.key,
              imageHash: s.sha256,
              uploadedBy: actor.sub,
              uploadedAt: receivedAt,
            })),
          );
        }
        return paymentId;
      });
      return { payment: await this.get(actor, id), replayed: false };
    } catch (err) {
      await this.discard(stored.map((s) => s.key));
      if (isUniqueViolation(err, 'payment_images_image_hash_unique')) {
        throw fail.duplicateImage();
      }
      if (isUniqueViolation(err, 'idx_payments_business_idempotency')) {
        const again = await this.findReplay(actor, dto, idempotencyKey);
        if (again) return again;
      }
      throw err;
    }
  }

  /**
   * Checks the shop, sale and plan, and returns the plan to attach. With
   * `lock`, also locks them (plan shared, shop exclusive) in the same order
   * sales use, so a plan cannot be closed under a payment being recorded.
   */
  private async resolveContext(
    executor: Database | Transaction,
    actor: StaffTokenPayload,
    dto: CreatePaymentDto,
    { lock = false } = {},
  ): Promise<{ dayPlanId: string | null }> {
    const plan = await workingPlan(executor, actor, dto.dayPlanId, {
      lock: lock ? 'share' : undefined,
      what: 'a payment',
    });
    const dayPlanId = plan?.id ?? null;

    const q = executor
      .select({ id: retailClients.id })
      .from(retailClients)
      .where(
        and(
          eq(retailClients.id, dto.clientId),
          eq(retailClients.businessId, actor.businessId),
        ),
      );
    // A deactivated shop can still pay what it owes.
    const [client] = await (lock ? q.for('update') : q);
    if (!client) throw fail.clientNotFound();

    if (dto.saleId) {
      const [sale] = await executor
        .select({ clientId: sales.clientId, status: sales.status })
        .from(sales)
        .where(
          and(eq(sales.id, dto.saleId), eq(sales.businessId, actor.businessId)),
        );
      if (!sale) throw fail.saleNotFound();
      if (sale.clientId !== dto.clientId) throw fail.saleMismatch();
      if (sale.status !== 'confirmed') throw fail.saleCancelled();
    }
    return { dayPlanId };
  }

  private async assertImagesUnused(hashes: string[]): Promise<void> {
    if (!hashes.length) return;
    const [used] = await this.db
      .select({ id: paymentImages.id })
      .from(paymentImages)
      .where(inArray(paymentImages.imageHash, hashes))
      .limit(1);
    if (used) throw fail.duplicateImage();
  }

  /** Best effort: a leftover file is harmless, a failed request is not. */
  private async discard(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.storage.delete(key).catch((err: unknown) => {
        this.logger.warn({ err, key }, 'Could not delete orphaned upload');
      });
    }
  }

  private async findReplay(
    actor: StaffTokenPayload,
    dto: CreatePaymentDto,
    idempotencyKey: string,
  ): Promise<CreatePaymentResult | null> {
    const [prior] = await this.db
      .select({
        id: payments.id,
        clientId: payments.clientId,
        amountPaisa: payments.amountPaisa,
        method: payments.method,
        collectedBy: payments.collectedBy,
      })
      .from(payments)
      .where(
        and(
          eq(payments.businessId, actor.businessId),
          eq(payments.idempotencyKey, idempotencyKey),
        ),
      );
    if (!prior) return null;
    if (
      prior.clientId !== dto.clientId ||
      prior.amountPaisa !== dto.amountPaisa ||
      prior.method !== dto.method ||
      (actor.role === 'salesman' && prior.collectedBy !== actor.sub)
    ) {
      throw fail.idempotencyConflict();
    }
    return { payment: await this.get(actor, prior.id), replayed: true };
  }

  // ---------- status ----------

  /** pending -> confirmed or bounced, once. Confirmed and bounced are final. */
  async setStatus(
    actor: StaffTokenPayload,
    id: string,
    status: 'confirmed' | 'bounced',
  ) {
    await withTransaction(this.db, async (tx) => {
      const [payment] = await tx
        .select({ status: payments.status })
        .from(payments)
        .where(
          and(eq(payments.id, id), eq(payments.businessId, actor.businessId)),
        )
        .for('update');
      if (!payment) throw fail.notFound();
      if (payment.status !== 'pending') throw fail.statusFinal(payment.status);
      await tx
        .update(payments)
        .set({ status })
        .where(
          and(eq(payments.id, id), eq(payments.businessId, actor.businessId)),
        );
    });
    return this.get(actor, id);
  }
}

/**
 * Applies the method's rules to the fields and files, and validates every
 * image (type by signature, size). Nothing is stored yet.
 */
async function checkProofs(
  dto: CreatePaymentDto,
  files: PaymentFiles,
): Promise<(UploadedImage & { kind: ImageKind })[]> {
  const allowed = KINDS_FOR[dto.method];
  const given = IMAGE_FIELDS.flatMap(({ name }) =>
    (files[name] ?? []).map((file) => ({ kind: name, file })),
  );
  for (const { kind } of given) {
    if (!allowed.includes(kind)) {
      throw fail.kindNotAllowed(kind, dto.method, allowed);
    }
  }

  if (dto.method === 'cheque') {
    if (!dto.chequeNumber) throw fail.chequeNumberRequired();
  } else if (dto.chequeNumber || dto.chequeBank || dto.chequeDate) {
    throw fail.chequeFieldsNotAllowed();
  }
  if (dto.method !== 'cash' && given.length === 0) {
    throw fail.proofRequired(dto.method);
  }

  const proofs = [];
  for (const { kind, file } of given) {
    proofs.push({ kind, ...(await validateImage(file.buffer)) });
  }
  // The same picture twice in one request is still one proof.
  if (new Set(proofs.map((p) => p.sha256)).size !== proofs.length) {
    throw fail.duplicateImage();
  }
  return proofs;
}
