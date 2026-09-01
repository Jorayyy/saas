import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary' })
  async getSummary(
    @CurrentUser('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getSummary(tenantId, branchId);
  }

  @Get('sales-chart')
  @ApiOperation({ summary: 'Get sales chart data' })
  async getSalesChart(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days') days?: number,
  ) {
    return this.dashboardService.getSalesChart(tenantId, days || 7);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top selling products' })
  async getTopProducts(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getTopProducts(tenantId, limit || 5);
  }

  @Get('top-technicians')
  @ApiOperation({ summary: 'Get top technicians' })
  async getTopTechnicians(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getTopTechnicians(tenantId, limit || 5);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent transactions' })
  async getRecentTransactions(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getRecentTransactions(tenantId, limit || 10);
  }
}
