import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService, CreateExpenseDto, UpdateExpenseDto, ExpenseQuery, CreateExpenseCategoryDto } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all expenses' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ExpenseQuery,
  ) {
    return this.expensesService.findAll(tenantId, query);
  }

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get expense summary' })
  async getSummary(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.expensesService.getSummary(tenantId, { from, to, branchId });
  }

  @Get('categories')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List expense categories' })
  async getCategories(@CurrentUser('tenantId') tenantId: string) {
    return this.expensesService.getCategories(tenantId);
  }

  @Post('categories')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create expense category' })
  async createCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.expensesService.createCategory(tenantId, dto);
  }

  @Put('categories/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update expense category' })
  async updateCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateExpenseCategoryDto>,
  ) {
    return this.expensesService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete expense category' })
  async deleteCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.deleteCategory(tenantId, id);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get expense by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a new expense' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(tenantId, dto, userId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update expense' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete expense' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.remove(tenantId, id);
  }

  @Put(':id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Approve expense' })
  async approve(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.approve(tenantId, id);
  }

  @Put(':id/reject')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Reject expense' })
  async reject(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.expensesService.reject(tenantId, id, reason);
  }
}
