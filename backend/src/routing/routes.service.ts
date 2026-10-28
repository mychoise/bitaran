import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray, SQL } from 'drizzle-orm';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { errorBody } from '../common/filters/all-exceptions.filter.js';
import { definedOnly } from '../common/utils/object.util.js';
import { isUniqueViolation } from '../common/utils/pg-error.util.js';
import { withTransaction } from '../common/utils/transaction.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database, Transaction } from '../database/database.types.js';
import {
  retailClients,
  routeClients,
  routes,
} from '../database/schema/index.js';
import { clientNotFound } from './clients.service.js';
import {
  CreateRouteDto,
  ListRoutesQueryDto,
  UpdateRouteDto,
} from './dto/route.dto.js';

const routeColumns = {
  id: routes.id,
  name: routes.name,
  description: routes.description,
  isActive: routes.isActive,
  createdBy: routes.createdBy,
  createdAt: routes.createdAt,
};

// The stop list shows what a salesman needs on the road, not account terms.
const stopColumns = {
  sequence: routeClients.sequence,
  id: retailClients.id,
  name: retailClients.name,
  ownerName: retailClients.ownerName,
  phone: retailClients.phone,
  address: retailClients.address,
  lat: retailClients.lat,
  lng: retailClients.lng,
  isActive: retailClients.isActive,
};

const notFound = () =>
  new NotFoundException(errorBody('ROUTE_NOT_FOUND', 'Route not found'));
const nameTaken = () =>
  new ConflictException(
    errorBody('ROUTE_NAME_TAKEN', 'A route with this name already exists'),
  );

@Injectable()
export class RoutesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list(businessId: string, query: ListRoutesQueryDto) {
    const filters: SQL[] = [eq(routes.businessId, businessId)];
    if (query.isActive !== undefined) {
      filters.push(eq(routes.isActive, query.isActive));
    }
    return this.db
      .select({ ...routeColumns, clientCount: count(routeClients.clientId) })
      .from(routes)
      .leftJoin(routeClients, eq(routeClients.routeId, routes.id))
      .where(and(...filters))
      .groupBy(routes.id)
      .orderBy(asc(routes.name));
  }

  /** The route with its shops in visiting order. */
  async get(
    businessId: string,
    id: string,
    executor: Database | Transaction = this.db,
  ) {
    const [route] = await executor
      .select(routeColumns)
      .from(routes)
      .where(owned(businessId, id));
    if (!route) throw notFound();
    const clients = await executor
      .select(stopColumns)
      .from(routeClients)
      .innerJoin(retailClients, eq(retailClients.id, routeClients.clientId))
      .where(eq(routeClients.routeId, id))
      .orderBy(asc(routeClients.sequence));
    return { ...route, clients };
  }

  async create(actor: StaffTokenPayload, dto: CreateRouteDto) {
    try {
      const [row] = await this.db
        .insert(routes)
        .values({
          ...definedOnly(dto),
          name: dto.name,
          id: randomUUID(),
          businessId: actor.businessId,
          createdBy: actor.sub,
          createdAt: new Date(),
        })
        .returning(routeColumns);
      return { ...row, clients: [] };
    } catch (err) {
      throw translate(err);
    }
  }

  async update(businessId: string, id: string, dto: UpdateRouteDto) {
    const changes = definedOnly(dto);
    if (Object.keys(changes).length) {
      try {
        const [row] = await this.db
          .update(routes)
          .set(changes)
          .where(owned(businessId, id))
          .returning({ id: routes.id });
        if (!row) throw notFound();
      } catch (err) {
        throw translate(err);
      }
    }
    return this.get(businessId, id);
  }

  /**
   * Replaces the route's stops with `clientIds`, in that order (sequence =
   * array index), atomically. Every shop must belong to the same business.
   */
  async setClients(businessId: string, id: string, clientIds: string[]) {
    return withTransaction(this.db, async (tx) => {
      // Lock the route so concurrent replacements apply one after another
      // instead of interleaving their delete and insert.
      const [route] = await tx
        .select({ id: routes.id })
        .from(routes)
        .where(owned(businessId, id))
        .for('update');
      if (!route) throw notFound();

      if (clientIds.length) {
        const found = await tx
          .select({ id: retailClients.id })
          .from(retailClients)
          .where(
            and(
              eq(retailClients.businessId, businessId),
              inArray(retailClients.id, clientIds),
            ),
          );
        if (found.length !== clientIds.length) throw clientNotFound();
      }

      await tx.delete(routeClients).where(eq(routeClients.routeId, id));
      if (clientIds.length) {
        await tx.insert(routeClients).values(
          clientIds.map((clientId, sequence) => ({
            routeId: id,
            clientId,
            sequence,
          })),
        );
      }
      return this.get(businessId, id, tx);
    });
  }
}

function owned(businessId: string, id: string) {
  return and(eq(routes.id, id), eq(routes.businessId, businessId));
}

function translate(err: unknown): unknown {
  if (isUniqueViolation(err, 'idx_routes_business_name')) return nameTaken();
  return err;
}
