import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService, CreateSaleDto, CreateRefundDto, SaleQuery } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Sales')
@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'List all sales' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: SaleQuery,
  ) {
    return this.salesService.findAll(tenantId, query);
  }

  @Get('daily-summary')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Get daily sales summary' })
  async getDailySummary(
    @CurrentUser('tenantId') tenantId: string,
    @Query('branchId') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.salesService.getDailySummary(tenantId, branchId, date);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Get sale by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.salesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Create a new sale' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(tenantId, dto, userId);
  }

  @Post(':id/refund')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Refund a sale' })
  async refund(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') saleId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.salesService.refund(tenantId, saleId, dto, userId);
  }
}
