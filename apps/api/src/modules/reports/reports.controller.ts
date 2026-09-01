import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get sales report' })
  async getSalesReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @Query('groupBy') groupIdBy?: string,
  ) {
    return this.reportsService.getSalesReport(tenantId, { from, to, branchId, groupIdBy: groupIdBy as any });
  }

  @Get('products')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get product sales report' })
  async getProductReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getProductReport(tenantId, { from, to, branchId });
  }

  @Get('profit')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get profit report' })
  async getProfitReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getProfitReport(tenantId, { from, to, branchId });
  }

  @Get('inventory')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get inventory valuation report' })
  async getInventoryReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getInventoryReport(tenantId, branchId);
  }
}
