import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SelfHealingService } from './self-healing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('System Health')
@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SelfHealingController {
  constructor(private readonly selfHealingService: SelfHealingService) {}

  @Get('health')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get system health status' })
  async getHealthStatus() {
    return this.selfHealingService.getHealthStatus();
  }

  @Get('metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get system metrics' })
  async getMetrics() {
    return this.selfHealingService.getMetrics();
  }

  @Get('issues')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get system issues' })
  async getIssues(@Query('resolved') resolved?: string) {
    return this.selfHealingService.getIssues(
      resolved !== undefined ? resolved === 'true' : undefined,
    );
  }

  @Put('issues/:id/resolve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Resolve issue' })
  async resolveIssue(@Param('id') id: string) {
    return this.selfHealingService.resolveIssue(id);
  }

  @Get('audit-logs')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    return this.selfHealingService.getAuditLogs(tenantId, { page, limit, action, userId });
  }

  @Post('audit-logs')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create audit log' })
  async createAuditLog(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: {
      action: string;
      entity: string;
      entityId?: string;
      oldValues?: any;
      newValues?: any;
    },
  ) {
    return this.selfHealingService.createAuditLog({
      ...dto,
      tenantId,
      userId,
    });
  }
}
