import { ApiProperty } from '@nestjs/swagger';
import { IsDateOnly } from '../../common/validators/date-only.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

/** The longest range analytics will build a per-day series for. */
export const MAX_ANALYTICS_DAYS = 366;

export class ReportRangeQueryDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'On or after (Nepal date)',
  })
  @IsDateOnly()
  from: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'On or before (Nepal date)',
  })
  @IsDateOnly()
  to: string;
}

export class HistoryQueryDto extends PaginationQueryDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'On or after (Nepal date)',
  })
  @IsDateOnly()
  from: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'On or before (Nepal date)',
  })
  @IsDateOnly()
  to: string;
}
