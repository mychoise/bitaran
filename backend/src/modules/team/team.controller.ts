import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  CurrentMembership,
  ActiveMembership,
} from '../../common/decorators/current-membership.decorator';
import { Organization } from '../orgs/orgs.types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('seller')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('team')
  @RequirePermission('team.manage_staff')
  async listTeam(
    @CurrentOrg() org: Organization,
    @CurrentMembership() membership?: ActiveMembership,
  ) {
    const actorRole = membership?.roleName || 'STAFF';
    return this.teamService.listTeamMembers(org.id, actorRole);
  }

  @Post('team')
  @RequirePermission('team.manage_staff')
  async createTeamMember(
    @CurrentOrg() org: Organization,
    @CurrentUser() user: JwtPayload,
    @CurrentMembership() membership: ActiveMembership | undefined,
    @Body() dto: CreateTeamMemberDto,
  ) {
    const actorRole = membership?.roleName || 'STAFF';

    if (dto.role === 'MANAGER' && actorRole !== 'OWNER') {
      throw new ForbiddenException('Only owners can create managers');
    }

    return this.teamService.createTeamMember(
      org.id,
      user.sub,
      actorRole,
      dto,
    );
  }

  @Patch('team/:membershipId')
  @RequirePermission('team.manage_staff')
  async updateTeamMember(
    @Param('membershipId') membershipId: string,
    @CurrentOrg() org: Organization,
    @CurrentUser() user: JwtPayload,
    @CurrentMembership() membership: ActiveMembership | undefined,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    const actorRole = membership?.roleName || 'STAFF';

    if (dto.role && actorRole !== 'OWNER') {
      throw new ForbiddenException('Only owners can change roles');
    }

    return this.teamService.updateTeamMember(
      org.id,
      membershipId,
      user.sub,
      actorRole,
      dto,
    );
  }

  @Post('team/:membershipId/disable')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('team.manage_staff')
  async disableTeamMember(
    @Param('membershipId') membershipId: string,
    @CurrentOrg() org: Organization,
    @CurrentUser() user: JwtPayload,
    @CurrentMembership() membership?: ActiveMembership,
  ) {
    const actorRole = membership?.roleName || 'STAFF';
    return this.teamService.disableTeamMember(
      org.id,
      membershipId,
      user.sub,
      actorRole,
    );
  }

  @Post('team/:membershipId/enable')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('team.manage_staff')
  async enableTeamMember(
    @Param('membershipId') membershipId: string,
    @CurrentOrg() org: Organization,
    @CurrentUser() user: JwtPayload,
    @CurrentMembership() membership?: ActiveMembership,
  ) {
    const actorRole = membership?.roleName || 'STAFF';
    return this.teamService.enableTeamMember(
      org.id,
      membershipId,
      user.sub,
      actorRole,
    );
  }

  @Post('team/:membershipId/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('team.manage_staff')
  async resetPassword(
    @Param('membershipId') membershipId: string,
    @CurrentOrg() org: Organization,
    @CurrentUser() user: JwtPayload,
    @CurrentMembership() membership?: ActiveMembership,
  ) {
    const actorRole = membership?.roleName || 'STAFF';
    return this.teamService.resetPassword(
      org.id,
      membershipId,
      user.sub,
      actorRole,
    );
  }

  @Get('activity')
  @RequirePermission('audit.view')
  async getActivity(
    @CurrentOrg() org: Organization,
    @Query() query: ActivityQueryDto,
  ) {
    return this.teamService.getActivity(org.id, query);
  }
}
