import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from './categories.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'List all categories' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.categoriesService.findAll(tenantId);
  }

  @Get('tree')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Get category tree' })
  async findTree(@CurrentUser('tenantId') tenantId: string) {
    return this.categoriesService.findTree(tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.categoriesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Create a new category' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'INVENTORY_MANAGER')
  @ApiOperation({ summary: 'Update a category' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete a category' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.categoriesService.remove(tenantId, id);
  }
}
