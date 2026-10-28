import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { StaffTokenPayload } from '../common/decorators/current-user.decorator.js';
import { IdempotencyKey } from '../common/decorators/idempotency-key.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { StaffOnly } from '../common/decorators/user-type.decorator.js';
import { ImagesUpload } from '../storage/image-upload.js';
import {
  CreatePaymentDto,
  IMAGE_FIELDS,
  ListPaymentsQueryDto,
  UpdatePaymentStatusDto,
} from './dto/payment.dto.js';
import { PaymentsService } from './payments.service.js';
import type { PaymentFiles } from './payments.service.js';

// All staff may record payments; salesmen on their own running day only,
// and they see only payments they collected.
@ApiTags('payments')
@ApiBearerAuth()
@StaffOnly()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * multipart/form-data: the fields of CreatePaymentDto, plus proof images in
   * fields named by kind (cheque_front, cheque_back, online_screenshot,
   * other). A cash payment with no images may also be sent as JSON.
   * 201 when created; 200 with Idempotent-Replayed: true on a retry.
   */
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @Post()
  @ImagesUpload([...IMAGE_FIELDS])
  async create(
    @CurrentUser() user: StaffTokenPayload,
    @IdempotencyKey() key: string,
    @Body() body: CreatePaymentDto,
    @UploadedFiles() files: PaymentFiles | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { payment, replayed } = await this.payments.create(
      user,
      body,
      files ?? {},
      key,
    );
    if (replayed) {
      res.status(HttpStatus.OK).setHeader('Idempotent-Replayed', 'true');
    }
    return payment;
  }

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.payments.list(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.get(user, id);
  }

  /** A manager confirms (money arrived) or bounces a pending payment. */
  @Roles('owner', 'manager')
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePaymentStatusDto,
  ) {
    return this.payments.setStatus(user, id, body.status);
  }
}
