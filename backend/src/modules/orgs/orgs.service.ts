import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../db/db.module';
import { organizations, addresses, memberships, roles } from '../../db/schema';
import { CreateAddressDto } from './dto/orgs.dto';

@Injectable()
export class OrgsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getMyOrgs(userId: string): Promise<unknown[]> {
    return this.db
      .select({
        orgId: memberships.orgId,
        orgName: organizations.name,
        roleName: roles.name,
        permissions: roles.permissions,
        canBuy: organizations.canBuy,
        canSell: organizations.canSell,
        orgStatus: organizations.status,
        orgType: organizations.type,
        panNumber: organizations.panNumber,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(organizations, eq(memberships.orgId, organizations.id))
      .where(eq(memberships.userId, userId));
  }

  async getAddresses(orgId: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(addresses)
      .where(eq(addresses.orgId, orgId));
  }

  async createAddress(orgId: string, dto: CreateAddressDto): Promise<unknown> {
    if (dto.isDefault) {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.orgId, orgId));
    }

    const [created] = await this.db
      .insert(addresses)
      .values({
        orgId,
        line1: dto.line1,
        city: dto.city,
        label: dto.label,
        district: dto.district,
        province: dto.province,
        phone: dto.phone,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    return created;
  }

  async updateAddress(
    orgId: string,
    addressId: string,
    dto: CreateAddressDto,
  ): Promise<unknown> {
    const existing = await this.db
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.orgId, orgId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) throw new NotFoundException('Address not found');

    if (dto.isDefault) {
      await this.db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.orgId, orgId));
    }

    const [updated] = await this.db
      .update(addresses)
      .set({
        line1: dto.line1,
        city: dto.city,
        label: dto.label,
        district: dto.district,
        province: dto.province,
        phone: dto.phone,
        isDefault: dto.isDefault ?? false,
      })
      .where(eq(addresses.id, addressId))
      .returning();

    return updated;
  }

  async deleteAddress(orgId: string, addressId: string): Promise<void> {
    const existing = await this.db
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.orgId, orgId)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) throw new NotFoundException('Address not found');

    await this.db.delete(addresses).where(eq(addresses.id, addressId));
  }
}
