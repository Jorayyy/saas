import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateEmployeeDto {
  userId?: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string;
  department?: string;
  branchId: string;
  employmentType?: string;
  salary?: number;
  hourlyRate?: number;
  hireDate: string;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {
  status?: string;
}

export interface LogAttendanceDto {
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  notes?: string;
}

export interface CreatePayrollDto {
  employeeId: string;
  period: string;
  baseSalary: number;
  allowances?: number;
  deductions?: number;
  overtime?: number;
  notes?: string;
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, status, department, position, search } = query;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(department && { department }),
      ...(position && { position }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        branch: true,
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        payroll: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Calculate work stats
    const stats = await this.calculateStats(tenantId, id);

    return { ...employee, stats };
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    // Generate employee code if not provided
    const employeeCode = dto.employeeCode || await this.generateEmployeeCode(tenantId);

    const existing = await this.prisma.employee.findFirst({
      where: { tenantId, employeeCode, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Employee code already exists');
    }

    // If user provided, link to user
    if (dto.userId) {
      const existingEmployee = await this.prisma.employee.findFirst({
        where: { tenantId, userId: dto.userId, deletedAt: null },
      });

      if (existingEmployee) {
        throw new BadRequestException('User already linked to an employee');
      }
    }

    return this.prisma.employee.create({
      data: {
        tenantId,
        employeeCode,
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        department: dto.department,
        branchId: dto.branchId,
        employmentType: dto.employmentType as any || 'FULL_TIME',
        salary: dto.salary,
        hourlyRate: dto.hourlyRate,
        hireDate: new Date(dto.hireDate),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.position && { position: dto.position }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.branchId && { branchId: dto.branchId }),
        ...(dto.employmentType && { employmentType: dto.employmentType as any }),
        ...(dto.salary !== undefined && { salary: dto.salary }),
        ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
        ...(dto.hireDate && { hireDate: new Date(dto.hireDate) }),
        ...(dto.status && { status: dto.status as any }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'TERMINATED' },
    });

    return { message: 'Employee terminated' };
  }

  async logAttendance(tenantId: string, dto: LogAttendanceDto, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const date = new Date(dto.date);

    // Check for existing attendance
    const existing = await this.prisma.attendance.findFirst({
      where: {
        employeeId: dto.employeeId,
        date,
        tenantId,
      },
    });

    if (existing && dto.clockOut) {
      // Update clock out
      const clockIn = existing.clockIn || new Date(dto.clockIn);
      const clockOut = new Date(dto.clockOut);
      const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut,
          hoursWorked,
          notes: dto.notes,
        },
      });
    }

    if (existing) {
      throw new BadRequestException('Attendance already logged for this date');
    }

    return this.prisma.attendance.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        date,
        clockIn: new Date(dto.clockIn),
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async getAttendance(tenantId: string, employeeId: string, query: any) {
    const { from, to } = query;

    const where: any = {
      employeeId,
      tenantId,
    };

    if (from && to) {
      where.date = {
        gte: new Date(from),
        lte: new Date(to),
      };
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async createPayroll(tenantId: string, dto: CreatePayrollDto, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check for duplicate period
    const existing = await this.prisma.payroll.findFirst({
      where: {
        employeeId: dto.employeeId,
        period: dto.period,
        tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException('Payroll already created for this period');
    }

    const totalPay = dto.baseSalary + (dto.allowances || 0) + (dto.overtime || 0) - (dto.deductions || 0);

    return this.prisma.payroll.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        period: dto.period,
        baseSalary: dto.baseSalary,
        allowances: dto.allowances || 0,
        deductions: dto.deductions || 0,
        overtime: dto.overtime || 0,
        totalPay,
        notes: dto.notes,
        status: 'PENDING',
        createdBy: userId,
      },
    });
  }

  async approvePayroll(tenantId: string, payrollId: string, userId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId, status: 'PENDING' },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found or already processed');
    }

    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status: 'APPROVED',
        paidDate: new Date(),
      },
    });
  }

  async getPayroll(tenantId: string, query: any) {
    const { period, status } = query;

    return this.prisma.payroll.findMany({
      where: {
        tenantId,
        ...(period && { period }),
        ...(status && { status }),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async calculateStats(tenantId: string, employeeId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [attendanceCount, repairsCompleted, salesTotal] = await Promise.all([
      this.prisma.attendance.count({
        where: {
          employeeId,
          tenantId,
          date: { gte: startOfMonth },
          clockOut: { not: null },
        },
      }),
      this.prisma.repairTicket.count({
        where: {
          technicianId: employeeId,
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: startOfMonth },
        },
      }),
      this.prisma.sale.aggregate({
        where: {
          userId: employeeId,
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      daysWorked: attendanceCount,
      repairsCompleted,
      salesTotal: Number(salesTotal._sum.total || 0),
    };
  }

  private async generateEmployeeCode(tenantId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { tenantId } });
    return `EMP-${String(count + 1).padStart(6, '0')}`;
  }
}
