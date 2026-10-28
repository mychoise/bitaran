import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { ImageUpload } from '../storage/image-upload.js';
import {
  CreateExpenseDto,
  ExpenseSummaryQueryDto,
  ListExpensesQueryDto,
  RECEIPT_FIELD,
  UpdateExpenseDto,
} from './dto/expense.dto.js';
import { ExpensesService } from './expenses.service.js';

// All staff may record and read expenses; salesmen only their own, and not
// salary (enforced in the service). Only managers and owners edit.
@ApiTags('expenses')
@ApiBearerAuth()
@StaffOnly()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /**
   * multipart/form-data: the fields of CreateExpenseDto, plus an optional
   * receipt image in the `receipt` field. Without a receipt it may also be
   * sent as JSON.
   */
  @ApiConsumes('multipart/form-data', 'application/json')
  @Post()
  @ImageUpload(RECEIPT_FIELD)
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateExpenseDto,
    @UploadedFile() receipt: Express.Multer.File | undefined,
  ) {
    return this.expenses.create(user, body, receipt);
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListExpensesQueryDto,
  ) {
    return this.expenses.list(user, query);
  }

  @Get('summary')
  summary(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ExpenseSummaryQueryDto,
  ) {
    return this.expenses.summary(user, query);
  }

  /** Overwrites in place; no edit history is kept (see the service). */
  @Roles('owner', 'manager')
  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateExpenseDto,
  ) {
    return this.expenses.update(user, id, body);
  }
}
