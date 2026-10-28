import { IsOptional, ValidateIf } from 'class-validator';

/**
 * For PATCH fields backed by a NOT NULL column: may be omitted, but `null`
 * is validated (and so rejected). Plain @IsOptional() would let null through.
 */
export const IsOmittable = () => ValidateIf((_o, value) => value !== undefined);

/** For PATCH fields backed by a nullable column: omit to keep, null to clear. */
export const IsNullable = () => IsOptional();
