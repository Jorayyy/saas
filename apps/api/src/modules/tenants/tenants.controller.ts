import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService, CreateTenantDto, UpdateTenantDto, TenantQuery } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all tenants' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.tenantsService.findAll({ page, limit, search, status, plan });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'TENANT_OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new tenant' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete tenant' })
  async remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  @Put(':id/settings')
  @Roles('SUPER_ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update tenant settings' })
  async updateSettings(
    @Param('id') id: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.tenantsService.updateSettings(id, settings);
  }

  @Get(':id/modules')
  @Roles('SUPER_ADMIN', 'TENANT_OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Get tenant modules' })
  async getModules(@Param('id') id: string) {
    return this.tenantsService.getModules(id);
  }

  @Put(':id/modules/:module')
  @Roles('SUPER_ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update tenant module' })
  async updateModule(
    @Param('id') id: string,
    @Param('module') module: string,
    @Body('enabled') enabled: boolean,
    @Body('settings') settings?: Record<string, any>,
  ) {
    return this.tenantsService.updateModule(id, module, enabled, settings);
  }

  @Put(':id/suspend')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Suspend tenant' })
  async suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id);
  }

  @Put(':id/reactivate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reactivate tenant' })
  async reactivate(@Param('id') id: string) {
    return this.tenantsService.reactivate(id);
  }
}
