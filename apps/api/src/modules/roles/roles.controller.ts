import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService, CreateRoleDto, UpdateRoleDto } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TENANT_OWNER')
  @ApiOperation({ summary: 'List all roles' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.rolesService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.rolesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Create a new role' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('TENANT_OWNER')
  @ApiOperation({ summary: 'Delete a role' })
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.rolesService.remove(tenantId, id);
  }

  @Put(':id/permissions')
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Sync role permissions' })
  async syncPermissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    return this.rolesService.syncPermissions(tenantId, id, permissionIds);
  }
}
