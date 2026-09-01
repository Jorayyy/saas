import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService, CreateSupplierDto, UpdateSupplierDto, SupplierQuery } from './suppliers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Suppliers')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all suppliers' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.suppliersService.findAll(tenantId, { page, limit, search, status });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get supplier by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.findOne(tenantId, id);
  }

  @Get(':id/products')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get supplier products' })
  async getProducts(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.getProducts(tenantId, id);
  }

  @Get(':id/orders')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get supplier purchase orders' })
  async getOrders(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.getOrders(tenantId, id);
  }

  @Get(':id/payments')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get supplier payments' })
  async getPayments(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.getPayments(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Create a new supplier' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliersService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Update a supplier' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete a supplier' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.suppliersService.remove(tenantId, id);
  }

  @Post(':id/payments')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Add supplier payment' })
  async addPayment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') supplierId: string,
    @Body() dto: { amount: number; paymentMethod: string; reference?: string; notes?: string; purchaseOrderId?: string },
  ) {
    return this.suppliersService.addPayment(tenantId, supplierId, dto, userId);
  }
}
