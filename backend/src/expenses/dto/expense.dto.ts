import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { IsDateOnly } from '../../common/validators/date-only.js';
import { IsNullable, IsOmittable } from '../../common/validators/optional.js';
import {
  BlankAsMissing,
  ToOptionalNumber,
} from '../../common/validators/transforms.js';

export const EXPENSE_TYPES = [
  'salary',
  'fuel',
  'khaja',
  'miscellaneous',
] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];
/** What a salesman may record, and only for himself. */
export const SALESMAN_EXPENSE_TYPES: readonly ExpenseType[] = [
  'fuel',
  'khaja',
  'miscellaneous',
];

/** The multipart form field that carries the optional receipt image. */
export const RECEIPT_FIELD = 'receipt';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Sent as multipart form fields (all strings) or JSON. Blank optional fields
// count as missing; numbers are converted.
export class CreateExpenseDto {
  @ApiProperty({ enum: EXPENSE_TYPES })
  @IsIn(EXPENSE_TYPES)
  type: ExpenseType;

  @ApiProperty({ minimum: 1 })
  @ToOptionalNumber()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountPaisa: number;

  @ApiPropertyOptional({
    example: '2026-10-28',
    description: 'Defaults to today (Nepal). Not in the future.',
  })
  @BlankAsMissing()
  @IsOptional()
  @IsDateOnly()
  expenseDate?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Whose expense. Required for salary. Salesmen: themselves (the default).',
  })
  @BlankAsMissing()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A day plan of the same staff member',
  })
  @BlankAsMissing()
  @IsOptional()
  @IsUUID()
  dayPlanId?: string;

  @ApiPropertyOptional({
    example: '2026-10',
    description:
      'Salary only: the month it pays for. Defaults to the expense date’s month.',
  })
  @BlankAsMissing()
  @IsOptional()
  @Matches(MONTH, { message: 'forMonth must be a month as YYYY-MM' })
  forMonth?: string;

  @ApiPropertyOptional()
  @BlankAsMissing()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

// JSON only; the receipt cannot be replaced here. Required columns may be
// changed but not cleared; nullable ones accept null.
export class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: EXPENSE_TYPES })
  @IsOmittable()
  @IsIn(EXPENSE_TYPES)
  type?: ExpenseType;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOmittable()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountPaisa?: number;

  @ApiPropertyOptional({ example: '2026-10-28' })
  @IsOmittable()
  @IsDateOnly()
  expenseDate?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsNullable()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsNullable()
  @IsUUID()
  dayPlanId?: string | null;

  @ApiPropertyOptional({ example: '2026-10', nullable: true })
  @IsNullable()
  @Matches(MONTH, { message: 'forMonth must be a month as YYYY-MM' })
  forMonth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNullable()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class ListExpensesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'On or after' })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'On or before' })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({ enum: EXPENSE_TYPES })
  @IsOptional()
  @IsIn(EXPENSE_TYPES)
  type?: ExpenseType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ignored for salesmen, who see only their own.',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class ExpenseSummaryQueryDto {
  @ApiProperty({ example: '2026-10-01', description: 'On or after' })
  @IsDateOnly()
  from: string;

  @ApiProperty({ example: '2026-10-31', description: 'On or before' })
  @IsDateOnly()
  to: string;
}
