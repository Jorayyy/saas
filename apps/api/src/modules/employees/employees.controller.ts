import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService, CreateEmployeeDto, UpdateEmployeeDto, LogAttendanceDto, CreatePayrollDto } from './employees.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List all employees' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('position') position?: string,
    @Query('search') search?: string,
  ) {
    return this.employeesService.findAll(tenantId, { page, limit, status, department, position, search });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get employee by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(tenantId, id);
  }

  @Get(':id/attendance')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get employee attendance' })
  async getAttendance(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.employeesService.getAttendance(tenantId, id, { from, to });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new employee' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update employee' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete employee' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.remove(tenantId, id);
  }

  @Post('attendance')
  @Roles('ADMIN', 'MANAGER', 'EMPLOYEE')
  @ApiOperation({ summary: 'Log attendance' })
  async logAttendance(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: LogAttendanceDto,
  ) {
    return this.employeesService.logAttendance(tenantId, dto, userId);
  }

  @Post('payroll')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create payroll' })
  async createPayroll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePayrollDto,
  ) {
    return this.employeesService.createPayroll(tenantId, dto, userId);
  }

  @Put('payroll/:id/approve')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Approve payroll' })
  async approvePayroll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.approvePayroll(tenantId, id, userId);
  }

  @Get('payroll/list')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List payroll' })
  async getPayroll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
  ) {
    return this.employeesService.getPayroll(tenantId, { period, status });
  }
}
