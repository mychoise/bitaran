import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { CreateAddressDto } from './dto/orgs.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Organization } from './orgs.types';

@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get(['mine', 'my'])
  async getMyOrgs(
    @CurrentUser() user: JwtPayload,
  ): Promise<unknown[]> {
    return this.orgsService.getMyOrgs(user.sub);
  }

  @Get('addresses')
  async getAddresses(@CurrentOrg() org: Organization): Promise<unknown[]> {
    return this.orgsService.getAddresses(org.id);
  }

  @Post('addresses')
  async createAddress(
    @CurrentOrg() org: Organization,
    @Body() dto: CreateAddressDto,
  ): Promise<unknown> {
    return this.orgsService.createAddress(org.id, dto);
  }

  @Put('addresses/:id')
  async updateAddress(
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
    @Body() dto: CreateAddressDto,
  ): Promise<unknown> {
    return this.orgsService.updateAddress(org.id, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('addresses/:id')
  async deleteAddress(
    @CurrentOrg() org: Organization,
    @Param('id') id: string,
  ): Promise<void> {
    return this.orgsService.deleteAddress(org.id, id);
  }
}
