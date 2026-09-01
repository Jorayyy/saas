import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RepairsService, CreateRepairDto, UpdateRepairDto } from './repairs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Repairs')
@Controller('repairs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RepairsController {
  constructor(private readonly repairsService: RepairsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'List repair tickets' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('branchId') branchId?: string,
    @Query('priority') priority?: string,
  ) {
    return this.repairsService.findAll(tenantId, { page, limit, status, technicianId, branchId, priority });
  }

  @Get('my-assigned')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Get my assigned repairs' })
  async getMyAssigned(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.repairsService.getMyAssigned(tenantId, userId);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get repair statistics' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.repairsService.getStats(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Get repair ticket by ID' })
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.repairsService.findOne(tenantId, id);
  }

  @Get(':id/timeline')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Get repair timeline' })
  async getTimeline(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.repairsService.getTimeline(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Create a new repair ticket' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRepairDto,
  ) {
    return this.repairsService.create(tenantId, userId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update repair ticket' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRepairDto,
  ) {
    return this.repairsService.update(tenantId, id, dto, userId);
  }

  @Put(':id/assign')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Assign technician to repair' })
  async assign(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('technicianId') technicianId: string,
  ) {
    return this.repairsService.assign(tenantId, id, technicianId, userId);
  }

  @Put(':id/complete')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Mark repair as complete' })
  async complete(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.repairsService.complete(tenantId, id, userId);
  }

  @Put(':id/pickup')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Pickup and pay for repair' })
  async pickup(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('payments') payments: Array<{ method: string; amount: number }>,
  ) {
    return this.repairsService.pickup(tenantId, id, payments, userId);
  }

  @Put(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Cancel repair' })
  async cancel(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.repairsService.cancel(tenantId, id, userId, reason);
  }

  @Post(':id/parts')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Add part to repair' })
  async addPart(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') repairId: string,
    @Body() dto: { productId: string; quantity: number; unitCost: number },
  ) {
    return this.repairsService.addPart(tenantId, repairId, dto, userId);
  }

  @Delete(':id/parts/:partId')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Remove part from repair' })
  async removePart(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') repairId: string,
    @Param('partId') partId: string,
  ) {
    return this.repairsService.removePart(tenantId, repairId, partId, userId);
  }
}
