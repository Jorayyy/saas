import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService, PaymentQuery } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all payments' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PaymentQuery,
  ) {
    return this.paymentsService.findAll(tenantId, query);
  }

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get payment summary' })
  async getSummary(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.getSummary(tenantId, from, to);
  }

  @Get('daily')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get daily payment breakdown' })
  async getDailyPayments(
    @CurrentUser('tenantId') tenantId: string,
    @Query('days') days?: number,
  ) {
    return this.paymentsService.getDailyPayments(tenantId, days);
  }
}
