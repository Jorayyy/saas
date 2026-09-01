import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService, SendNotificationDto, NotificationQuery } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'List notifications' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: NotificationQuery,
  ) {
    return this.notificationsService.findAll(tenantId, query);
  }

  @Get('unread-count')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Get unread count' })
  async getUnreadCount(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.getUnreadCount(tenantId, userId);
  }

  @Get('templates')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List notification templates' })
  async getTemplates(@CurrentUser('tenantId') tenantId: string) {
    return this.notificationsService.getTemplates(tenantId);
  }

  @Post('templates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create notification template' })
  async createTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { name: string; type: string; subject?: string; body: string; variables?: string[] },
  ) {
    return this.notificationsService.createTemplate(tenantId, dto);
  }

  @Post('send')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Send notification' })
  async send(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: SendNotificationDto,
  ) {
    return this.notificationsService.send({ ...dto, tenantId });
  }

  @Post('send-templated')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Send templated notification' })
  async sendTemplated(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { templateId: string; data: Record<string, any>; userId?: string },
  ) {
    return this.notificationsService.sendTemplated(tenantId, dto.templateId, dto.data, dto.userId);
  }

  @Put(':id/read')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Mark as read' })
  async markAsRead(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(tenantId, id);
  }

  @Put('read-all')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Mark all as read' })
  async markAllAsRead(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAllAsRead(tenantId, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'TECHNICIAN', 'CASHIER', 'STAFF')
  @ApiOperation({ summary: 'Delete notification' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.remove(tenantId, id);
  }
}
