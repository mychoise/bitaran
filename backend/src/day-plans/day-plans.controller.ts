import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ClosingService } from './closing.service.js';
import { DayPlansService } from './day-plans.service.js';
import { CloseDayPlanDto, ReconcileDayPlanDto } from './dto/closing.dto.js';
import { CreateDayPlanDto, ListDayPlansQueryDto } from './dto/day-plan.dto.js';
import { AddVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import { VisitsService } from './visits.service.js';
import { VisitPhotosService } from './visit-photos.service.js';
import {
  ListVisitPhotosQueryDto,
  UploadVisitPhotoDto,
} from './dto/visit-photo.dto.js';
import { ImageUpload, ParseImagePipe } from '../storage/image-upload.js';
import type { UploadedImage } from '../storage/image-upload.js';

// Salesmen may read, and only their own plans (enforced in the service).
@ApiTags('day-plans')
@ApiBearerAuth()
@StaffOnly()
@Controller('day-plans')
export class DayPlansController {
  constructor(
    private readonly dayPlans: DayPlansService,
    private readonly visits: VisitsService,
    private readonly closing: ClosingService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListDayPlansQueryDto,
  ) {
    return this.dayPlans.list(user, query);
  }

  // Declared before ':id' so "today" is not taken for an id.
  @Roles('salesman')
  @Get('today')
  today(@CurrentUser() user: StaffTokenPayload) {
    return this.dayPlans.today(user);
  }

  @Get(':id')
  get(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dayPlans.get(user, id);
  }

  @Roles('owner', 'manager')
  @Post()
  create(
    @CurrentUser() user: StaffTokenPayload,
    @Body() body: CreateDayPlanDto,
  ) {
    return this.dayPlans.create(user, body);
  }

  /** The plan's own salesman starts his day: planned -> in_progress. */
  @Roles('salesman')
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dayPlans.start(user, id);
  }

  /** Adds an ad-hoc shop to the salesman's running day. */
  @Roles('salesman')
  @Post(':id/visits')
  addVisit(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddVisitDto,
  ) {
    return this.visits.add(user, id, body);
  }

  /** The plan's own salesman ends his day: in_progress -> closed. */
  @Roles('salesman')
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CloseDayPlanDto,
  ) {
    return this.closing.close(user, id, body);
  }

  /** A manager counts the returned stock: closed -> reconciled. */
  @Roles('owner', 'manager')
  @Post(':id/reconcile')
  @HttpCode(HttpStatus.OK)
  reconcile(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReconcileDayPlanDto,
  ) {
    return this.closing.reconcile(user, id, body);
  }

  /** Stock and cash for the day. Salesmen: their own plans only. */
  @Get(':id/report')
  report(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.closing.report(user, id);
  }

  /** Only while planned; restores the issued stock. */
  @Roles('owner', 'manager')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.dayPlans.delete(user, id);
  }
}

@ApiTags('day-plans')
@ApiBearerAuth()
@StaffOnly()
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly photos: VisitPhotosService,
  ) {}

  /** Mark a stop visited or skipped. visited_at comes from the server clock. */
  @Roles('salesman')
  @Patch(':id')
  update(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateVisitDto,
  ) {
    return this.visits.update(user, id, body);
  }

  /**
   * multipart/form-data: the image in field "photo", plus optional lat, lng
   * and note. Stamped with the server time before it is stored. Suspicious
   * photos are flagged (flagReason), never refused.
   */
  @ApiConsumes('multipart/form-data')
  @Roles('salesman')
  @Post(':id/photos')
  @ImageUpload('photo')
  uploadPhoto(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ParseImagePipe) image: UploadedImage,
    @Body() body: UploadVisitPhotoDto,
  ) {
    return this.photos.upload(user, id, image, body);
  }

  /** Salesmen: photos on their own visits only. */
  @Get(':id/photos')
  listPhotos(
    @CurrentUser() user: StaffTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.photos.forVisit(user, id);
  }
}

/** Photo review across the business. */
@ApiTags('day-plans')
@ApiBearerAuth()
@StaffOnly()
@Roles('owner', 'manager')
@Controller('visit-photos')
export class VisitPhotosController {
  constructor(private readonly photos: VisitPhotosService) {}

  @Get()
  list(
    @CurrentUser() user: StaffTokenPayload,
    @Query() query: ListVisitPhotosQueryDto,
  ) {
    return this.photos.list(user, query);
  }
}
