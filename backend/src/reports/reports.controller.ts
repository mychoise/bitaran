import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { HistoryQueryDto, ReportRangeQueryDto } from './dto/report.dto.js';
import { ReportsService } from './reports.service.js';

// Salesmen may request only their own reports (enforced in the service);
// the business-wide ones are for managers and owners.
@ApiTags('reports')
@ApiBearerAuth()
@StaffOnly()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Salesmen: their own day. Managers/owners: the business, per salesman. */
  @Get('today')
  today(@CurrentUser() user: StaffTokenPayload) {
    return this.reports.today(user);
  }

  @Get('salesman/:id/history')
  history(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.reports.history(user, id, query);
  }

  @Get('salesman/:id/analytics')
  analytics(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportRangeQueryDto,
  ) {
    return this.reports.analytics(user, id, query);
  }

  @Roles('owner', 'manager')
  @Get('overdue-credit')
  overdueCredit(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reports.overdueCredit(user, query);
  }

  @Roles('owner', 'manager')
  @Get('low-stock')
  lowStock(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reports.lowStock(user, query);
  }
}
