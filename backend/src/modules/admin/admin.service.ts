import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import {
  organizations,
  categories,
  orders,
  shipments,
  auditLogs,
} from '../../db/schema';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ---- Org management ----

  async listOrgs(status?: string): Promise<unknown[]> {
    const conditions = [];
    if (status) conditions.push(eq(organizations.status, status as 'PENDING' | 'APPROVED' | 'SUSPENDED'));

    return this.db
      .select()
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async updateOrgStatus(
    orgId: string,
    status: 'APPROVED' | 'SUSPENDED' | 'PENDING',
    actorId: string,
  ): Promise<unknown> {
    const org = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
      .then((r) => r[0]);

    if (!org) throw new NotFoundException('Organization not found');

    const [updated] = await this.db
      .update(organizations)
      .set({ status })
      .where(eq(organizations.id, orgId))
      .returning();

    await this.db.insert(auditLogs).values({
      actorId,
      orgId,
      action: `org.status.${status.toLowerCase()}`,
      entity: 'Organization',
      entityId: orgId,
      meta: { newStatus: status },
    });

    return updated;
  }

  async getDashboardStats(): Promise<unknown> {
    const [pendingOrgs] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.status, 'PENDING'));

    const pendingApprovalsCount = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.status, 'PENDING'))
      .then((r) => r.length);

    const suspendedCount = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.status, 'SUSPENDED'))
      .then((r) => r.length);

    const activeShipmentsCount = await this.db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.status, 'IN_TRANSIT'),
        ),
      )
      .then((r) => r.length);

    const pendingOrgsForTable = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.status, 'PENDING'))
      .limit(5);

    return {
      pendingApprovals: pendingApprovalsCount,
      activeShipments: activeShipmentsCount,
      suspendedBusinesses: suspendedCount,
      pendingOrgs: pendingOrgsForTable,
    };
  }

  // ---- Category management ----

  async listCategories(): Promise<unknown[]> {
    return this.db.select().from(categories);
  }

  async createCategory(name: string, parentId?: string): Promise<unknown> {
    const [created] = await this.db
      .insert(categories)
      .values({ name, parentId })
      .returning();
    return created;
  }

  async updateCategory(
    id: string,
    name: string,
    parentId?: string,
  ): Promise<unknown> {
    const [updated] = await this.db
      .update(categories)
      .set({ name, parentId })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Category not found');
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.delete(categories).where(eq(categories.id, id));
  }

  // ---- All orders ----

  async listAllOrders(status?: string): Promise<unknown[]> {
    return this.db
      .select({
        id: orders.id,
        buyerOrgId: orders.buyerOrgId,
        sellerOrgId: orders.sellerOrgId,
        status: orders.status,
        totalPaisa: orders.totalPaisa,
        createdAt: orders.createdAt,
      })
      .from(orders);
  }
}
