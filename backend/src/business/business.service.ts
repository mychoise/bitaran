import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { definedOnly } from '../common/utils/object.util.js';
import { DRIZZLE } from '../database/database.types.js';
import type { Database } from '../database/database.types.js';
import { businesses } from '../database/schema/index.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';

const businessColumns = {
  id: businesses.id,
  name: businesses.name,
  panNumber: businesses.panNumber,
  registrationNumber: businesses.registrationNumber,
  phone: businesses.phone,
  email: businesses.email,
  address: businesses.address,
  city: businesses.city,
  logoKey: businesses.logoKey,
  isActive: businesses.isActive,
  createdAt: businesses.createdAt,
};

@Injectable()
export class BusinessService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The caller's own business; the guard has already checked it is active. */
  async get(businessId: string) {
    const [row] = await this.db
      .select(businessColumns)
      .from(businesses)
      .where(eq(businesses.id, businessId));
    return row;
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    const changes = definedOnly(dto);
    if (Object.keys(changes).length === 0) return this.get(businessId);
    const [row] = await this.db
      .update(businesses)
      .set(changes)
      .where(eq(businesses.id, businessId))
      .returning(businessColumns);
    return row;
  }
}
