import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductsService, CreateProductDto, UpdateProductDto, ProductQuery } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'TECHNICIAN', 'STAFF')
  @ApiOperation({ summary: 'List all products' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ProductQuery,
  ) {
    return this.productsService.findAll(tenantId, query);
  }

  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get low stock products' })
  async getLowStock(@CurrentUser('tenantId') tenantId: string) {
    return this.productsService.getLowStock(tenantId);
  }

  @Get('out-of-stock')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get out of stock products' })
  async getOutOfStock(@CurrentUser('tenantId') tenantId: string) {
    return this.productsService.getOutOfStock(tenantId);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Export products to CSV' })
  async exportCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
    @Query() query: ProductQuery,
  ) {
    const csv = await this.productsService.exportCsv(tenantId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(csv);
  }

  @Get('barcode/:barcode')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Lookup product by barcode' })
  async findByBarcode(
    @CurrentUser('tenantId') tenantId: string,
    @Param('barcode') barcode: string,
  ) {
    return this.productsService.findByBarcode(tenantId, barcode);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'TECHNICIAN', 'STAFF')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.findOne(tenantId, id);
  }

  @Get(':id/movements')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Get product inventory movements' })
  async getMovements(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.getMovements(tenantId, id, page, limit);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Create a new product' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenantId, dto);
  }

  @Post('import')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Bulk import products' })
  async bulkImport(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body('items') items: any[],
  ) {
    return this.productsService.bulkImport(tenantId, items, userId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete a product' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.remove(tenantId, id);
  }

  @Post(':id/adjust')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Adjust product stock' })
  async adjustStock(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Body() body: {
      adjustmentType: string;
      quantity: number;
      reason: string;
      branchId: string;
    },
  ) {
    return this.productsService.adjustStock(
      tenantId,
      productId,
      body.adjustmentType,
      body.quantity,
      body.reason,
      userId,
      body.branchId,
    );
  }
}
