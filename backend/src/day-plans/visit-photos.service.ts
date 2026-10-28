import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, isNotNull, SQL, sql } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { distanceInMetres } from '../common/utils/geo.util.js';
import {
  buildPaginatedResult,
  getOffset,
} from '../common/utils/pagination.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import type { AppConfigService } from '../config/app-config.module.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  dayPlans,
  retailClients,
  users,
  visitPhotos,
  visits,
} from '../database/schema/index.js';
import { exifTakenAt } from '../storage/exif.js';
import type { UploadedImage } from '../storage/image-upload.js';
import { ImageService } from '../storage/image.service.js';
import { newStorageKey } from '../storage/storage-key.js';
import { StorageService } from '../storage/storage.service.js';
import { visibleTo } from './day-plans.service.js';
import {
  ListVisitPhotosQueryDto,
  UploadVisitPhotoDto,
} from './dto/visit-photo.dto.js';

/** Why a photo deserves a second look. Flags never reject a photo. */
export type PhotoFlag = 'no_exif' | 'exif_old' | 'too_far';

const fail = {
  visitNotFound: () =>
    new NotFoundException(errorBody('VISIT_NOT_FOUND', 'Visit not found')),
  notInProgress: (status: string) =>
    new ConflictException(
      errorBody(
        'DAY_PLAN_NOT_IN_PROGRESS',
        `Photos can only be added while the day is in progress; this plan is ${status}`,
      ),
    ),
  duplicate: () =>
    new ConflictException(
      errorBody(
        'DUPLICATE_PHOTO',
        'This exact photo was already uploaded; take a new one',
      ),
    ),
};

const photoColumns = {
  id: visitPhotos.id,
  visitId: visitPhotos.visitId,
  imageKey: visitPhotos.imageKey,
  takenAt: visitPhotos.takenAt,
  exifTakenAt: visitPhotos.exifTakenAt,
  lat: visitPhotos.lat,
  lng: visitPhotos.lng,
  distanceFromShopM: visitPhotos.distanceFromShopM,
  flagReason: visitPhotos.flagReason,
  note: visitPhotos.note,
};

@Injectable()
export class VisitPhotosService {
  private readonly logger = new Logger(VisitPhotosService.name);
  private readonly maxSkewMs: number;
  private readonly maxDistanceM: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    @Inject(ConfigService) config: AppConfigService,
  ) {
    this.maxSkewMs =
      config.get('PHOTO_EXIF_MAX_SKEW_MINUTES', { infer: true }) * 60_000;
    this.maxDistanceM = config.get('PHOTO_MAX_DISTANCE_M', { infer: true });
  }

  /**
   * Adds a photo to the salesman's own visit on his running day. The stored
   * file is the stamped one; the original bytes are only hashed and read for
   * EXIF, never kept. taken_at is the server clock, whatever the photo says.
   */
  async upload(
    actor: StaffTokenPayload,
    visitId: string,
    image: UploadedImage,
    dto: UploadVisitPhotoDto,
  ) {
    await this.ownVisit(actor, visitId); // fail before any work
    const [used] = await this.db
      .select({ id: visitPhotos.id })
      .from(visitPhotos)
      .where(eq(visitPhotos.imageHash, image.sha256));
    if (used) throw fail.duplicate();

    const takenAt = new Date();
    const exifAt = await exifTakenAt(image.buffer); // before stamping strips it
    const shop = await this.shopLocation(visitId);
    const distance =
      dto.lat !== undefined &&
      dto.lng !== undefined &&
      shop.lat !== null &&
      shop.lng !== null
        ? Math.round(
            distanceInMetres(
              { lat: dto.lat, lng: dto.lng },
              { lat: shop.lat, lng: shop.lng },
            ),
          )
        : null;
    const flags = this.flagsFor(takenAt, exifAt, distance);

    const key = newStorageKey(actor.businessId, 'visit-photos');
    const stamped = await this.images.stampDate(image.buffer, takenAt);
    await this.storage.put(key, stamped, image.mime);

    try {
      const id = await withTransaction(this.db, async (tx) => {
        // Re-checked under a shared lock, so the day cannot close meanwhile.
        await this.ownVisit(actor, visitId, tx);
        const photoId = randomUUID();
        await tx.insert(visitPhotos).values({
          id: photoId,
          visitId,
          imageKey: key,
          takenAt,
          lat: dto.lat,
          lng: dto.lng,
          note: dto.note,
          exifTakenAt: exifAt,
          imageHash: image.sha256,
          distanceFromShopM: distance,
          flagReason: flags.length ? flags.join(',') : null,
        });
        return photoId;
      });
      const [row] = await this.db
        .select(photoColumns)
        .from(visitPhotos)
        .where(eq(visitPhotos.id, id));
      return row;
    } catch (err) {
      await this.storage.delete(key).catch((e: unknown) => {
        this.logger.warn({ err: e, key }, 'Could not delete orphaned upload');
      });
      if (isUniqueViolation(err, 'visit_photos_image_hash_unique')) {
        throw fail.duplicate();
      }
      throw err;
    }
  }

  flagsFor(
    serverAt: Date,
    exifAt: Date | null,
    distanceM: number | null,
  ): PhotoFlag[] {
    const flags: PhotoFlag[] = [];
    if (!exifAt) flags.push('no_exif');
    else if (Math.abs(serverAt.getTime() - exifAt.getTime()) > this.maxSkewMs) {
      flags.push('exif_old');
    }
    if (distanceM !== null && distanceM > this.maxDistanceM) {
      flags.push('too_far');
    }
    return flags;
  }

  /** A visit's photos. Salesmen: only on their own plans. */
  async forVisit(actor: StaffTokenPayload, visitId: string) {
    const [visit] = await this.db
      .select({ id: visits.id })
      .from(visits)
      .innerJoin(dayPlans, eq(dayPlans.id, visits.dayPlanId))
      .where(and(eq(visits.id, visitId), visibleTo(actor)));
    if (!visit) throw fail.visitNotFound();
    return this.db
      .select(photoColumns)
      .from(visitPhotos)
      .where(eq(visitPhotos.visitId, visitId))
      .orderBy(asc(visitPhotos.takenAt));
  }

  /** Photos across the business, for review. Managers and owners. */
  async list(actor: StaffTokenPayload, query: ListVisitPhotosQueryDto) {
    const filters: SQL[] = [eq(dayPlans.businessId, actor.businessId)];
    if (query.flagged === true) filters.push(isNotNull(visitPhotos.flagReason));
    if (query.flagged === false) {
      filters.push(sql`${visitPhotos.flagReason} is null`);
    }
    if (query.date) {
      filters.push(
        sql`(${visitPhotos.takenAt} at time zone 'Asia/Kathmandu')::date = ${query.date}`,
      );
    }
    if (query.salesmanId) {
      filters.push(eq(dayPlans.salesmanId, query.salesmanId));
    }
    if (query.dayPlanId) filters.push(eq(dayPlans.id, query.dayPlanId));
    const where = and(...filters);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          ...photoColumns,
          dayPlanId: dayPlans.id,
          shop: { id: retailClients.id, name: retailClients.name },
          salesman: { id: users.id, fullName: users.fullName },
        })
        .from(visitPhotos)
        .innerJoin(visits, eq(visits.id, visitPhotos.visitId))
        .innerJoin(dayPlans, eq(dayPlans.id, visits.dayPlanId))
        .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
        .innerJoin(users, eq(users.id, dayPlans.salesmanId))
        .where(where)
        .orderBy(desc(visitPhotos.takenAt), desc(visitPhotos.id))
        .limit(query.limit)
        .offset(getOffset(query)),
      this.db
        .select({ total: count() })
        .from(visitPhotos)
        .innerJoin(visits, eq(visits.id, visitPhotos.visitId))
        .innerJoin(dayPlans, eq(dayPlans.id, visits.dayPlanId))
        .where(where),
    ]);
    return buildPaginatedResult(rows, total, query);
  }

  /**
   * The visit, if it is on this salesman's own plan, which must be in
   * progress. Inside a transaction the plan is share-locked.
   */
  private async ownVisit(
    actor: StaffTokenPayload,
    visitId: string,
    tx?: Transaction,
  ) {
    const q = (tx ?? this.db)
      .select({ status: dayPlans.status })
      .from(visits)
      .innerJoin(dayPlans, eq(dayPlans.id, visits.dayPlanId))
      .where(
        and(
          eq(visits.id, visitId),
          eq(dayPlans.businessId, actor.businessId),
          eq(dayPlans.salesmanId, actor.sub),
        ),
      );
    const [plan] = await (tx ? q.for('share', { of: dayPlans }) : q);
    // Another salesman's visit is reported as missing.
    if (!plan) throw fail.visitNotFound();
    if (plan.status !== 'in_progress') throw fail.notInProgress(plan.status);
  }

  private async shopLocation(visitId: string) {
    const [shop] = await this.db
      .select({ lat: retailClients.lat, lng: retailClients.lng })
      .from(visits)
      .innerJoin(retailClients, eq(retailClients.id, visits.clientId))
      .where(eq(visits.id, visitId));
    return shop;
  }
}
