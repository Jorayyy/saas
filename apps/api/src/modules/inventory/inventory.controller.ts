import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService, CreateTransferDto, StockAdjustmentDto } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get inventory overview' })
  async getOverview(@CurrentUser('tenantId') tenantId: string) {
    return this.inventoryService.getOverview(tenantId);
  }

  @Get('movements')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get inventory movements' })
  async getMovements(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
    @Query('transactionType') transactionType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.inventoryService.getMovements(tenantId, {
      page, limit, productId, branchId, transactionType, from, to,
    });
  }

  @Post('adjust')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Adjust stock' })
  async adjustStock(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.adjustStock(tenantId, dto, userId);
  }

  @Post('transfer')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Create stock transfer' })
  async createTransfer(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.inventoryService.createTransfer(tenantId, dto, userId);
  }

  @Get('transfers')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'List transfers' })
  async findAllTransfers(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.inventoryService.findAll(tenantId, { page, limit, status });
  }

  @Get('transfers/:id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get transfer details' })
  async findOneTransfer(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOne(tenantId, id);
  }

  @Put('transfers/:id/receive')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Receive transfer' })
  async receiveTransfer(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.receiveTransfer(tenantId, id, userId);
  }

  @Put('transfers/:id/cancel')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Cancel transfer' })
  async cancelTransfer(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.cancelTransfer(tenantId, id, userId);
  }
}
