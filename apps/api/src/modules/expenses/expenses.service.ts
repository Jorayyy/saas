import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateExpenseDto {
  expenseNumber?: string;
  categoryId: string;
  branchId: string;
  amount: number;
  description: string;
  date: string;
  paymentMethod: string;
  reference?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  notes?: string;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {
  status?: string;
}

export interface CreateExpenseCategoryDto {
  name: string;
  description?: string;
  parentId?: string;
}

export interface ExpenseQuery {
  page?: number;
  limit?: number;
  categoryId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  status?: string;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: ExpenseQuery) {
    const { page = 1, limit = 20, categoryId, branchId, from, to, status } = query;

    const where: any = {
      tenantId,
      ...(categoryId && { categoryId }),
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(from && to && {
        date: { gte: new Date(from), lte: new Date(to) },
      }),
    };

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async create(tenantId: string, dto: CreateExpenseDto, userId: string) {
    // Generate expense number if not provided
    const expenseNumber = dto.expenseNumber || await this.generateExpenseNumber(tenantId);

    // Verify category
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: dto.categoryId, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    return this.prisma.expense.create({
      data: {
        tenantId,
        expenseNumber,
        categoryId: dto.categoryId,
        branchId: dto.branchId,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
        paymentMethod: dto.paymentMethod as any,
        reference: dto.reference,
        isRecurring: dto.isRecurring || false,
        recurringInterval: dto.recurringInterval as any,
        notes: dto.notes,
        status: 'APPROVED',
        userId,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.branchId && { branchId: dto.branchId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description && { description: dto.description }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.paymentMethod && { paymentMethod: dto.paymentMethod as any }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
        ...(dto.recurringInterval && { recurringInterval: dto.recurringInterval as any }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status as any }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted' };
  }

  async approve(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found or already processed');
    }

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async reject(tenantId: string, id: string, reason?: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found or already processed');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason,
      },
    });
  }

  async getSummary(tenantId: string, params: { from?: string; to?: string; branchId?: string }) {
    const { from, to, branchId } = params;

    const dateFilter = from && to
      ? { date: { gte: new Date(from), lte: new Date(to) } }
      : {};

    const where = {
      tenantId,
      status: 'APPROVED',
      ...dateFilter,
      ...(branchId && { branchId }),
    };

    const [total, byCategory, byMonth] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['date'],
        where,
        _sum: { amount: true },
      }),
    ]);

    // Get category names
    const categoryIds = byCategory.map(bc => bc.categoryId);
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    // Group by month
    const monthlyTotals: Record<string, number> = {};
    byMonth.forEach(item => {
      const month = item.date.toISOString().split('T')[0].substring(0, 7);
      monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(item._sum.amount);
    });

    return {
      totalExpenses: Number(total._sum.amount || 0),
      totalCount: total._count,
      byCategory: byCategory.map(bc => ({
        category: categories.find(c => c.id === bc.categoryId),
        amount: Number(bc._sum.amount),
        count: bc._count,
      })),
      byMonth: monthlyTotals,
    };
  }

  async getCategories(tenantId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: { select: { expenses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Category name already exists');
    }

    return this.prisma.expenseCategory.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        parentId: dto.parentId,
      },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: Partial<CreateExpenseCategoryDto>) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { expenses: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.expenses > 0) {
      // Soft delete
      await this.prisma.expenseCategory.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { message: 'Category deactivated' };
    }

    await this.prisma.expenseCategory.delete({ where: { id } });
    return { message: 'Category deleted' };
  }

  private async generateExpenseNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.expense.count({ where: { tenantId } });
    return `EXP-${String(count + 1).padStart(6, '0')}`;
  }
}
