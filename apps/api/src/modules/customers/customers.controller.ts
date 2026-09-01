import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService, CreateCustomerDto, UpdateCustomerDto, CustomerQuery, CreateDeviceDto } from './customers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'List all customers' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: CustomerQuery,
  ) {
    return this.customersService.findAll(tenantId, query);
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Search customers' })
  async search(
    @CurrentUser('tenantId') tenantId: string,
    @Query('q') q: string,
  ) {
    return this.customersService.search(tenantId, q);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get customer by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.findOne(tenantId, id);
  }

  @Get(':id/devices')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Get customer devices' })
  async getDevices(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getDevices(tenantId, id);
  }

  @Get(':id/credits')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Get customer credits' })
  async getCredits(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getCredits(tenantId, id);
  }

  @Get(':id/lifetime-value')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get customer lifetime value' })
  async getLifetimeValue(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getLifetimeValue(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Create a new customer' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Update a customer' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete a customer' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.remove(tenantId, id);
  }

  @Post(':id/devices')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Add customer device' })
  async addDevice(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') customerId: string,
    @Body() dto: CreateDeviceDto,
  ) {
    return this.customersService.addDevice(tenantId, customerId, dto);
  }

  @Post(':id/credits')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Add customer credit' })
  async addCredit(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') customerId: string,
    @Body() dto: { amount: number; type: string; notes?: string },
  ) {
    return this.customersService.addCredit(tenantId, customerId, dto, userId);
  }
}
