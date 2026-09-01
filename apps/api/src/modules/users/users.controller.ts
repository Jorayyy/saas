import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService, CreateUserDto, UpdateUserDto, UserQuery } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TENANT_OWNER')
  @ApiOperation({ summary: 'List all users' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('roleId') roleId?: string,
  ) {
    return this.usersService.findAll(tenantId, { page, limit, search, status, roleId });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.usersService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Create a new user' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('TENANT_OWNER')
  @ApiOperation({ summary: 'Delete a user' })
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.usersService.remove(tenantId, id);
  }

  @Put(':id/status')
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Update user status' })
  async updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.usersService.updateStatus(tenantId, id, status);
  }

  @Post(':id/reset-password')
  @Roles('ADMIN', 'TENANT_OWNER')
  @ApiOperation({ summary: 'Reset user password (admin)' })
  async resetPassword(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.usersService.resetPassword(tenantId, id);
  }
}
