import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface SendNotificationDto {
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: string[];
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  type?: string;
  isRead?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async findAll(tenantId: string, query: NotificationQuery) {
    const { page = 1, limit = 20, type, isRead } = query;

    const where: any = {
      tenantId,
      ...(type && { type }),
      ...(isRead !== undefined && { isRead }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(tenantId: string, userId?: string) {
    const where: any = {
      tenantId,
      isRead: false,
      ...(userId && { userId }),
    };

    const count = await this.prisma.notification.count({ where });
    return { count };
  }

  async send(dto: SendNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        type: dto.type as any,
        title: dto.title,
        message: dto.message,
        data: dto.data,
        channels: dto.channels || ['IN_APP'],
        isRead: false,
      },
    });

    // Send to specified channels
    const channels = dto.channels || ['IN_APP'];

    for (const channel of channels) {
      try {
        await this.sendToChannel(channel, dto);
      } catch (error) {
        this.logger.error(`Failed to send via ${channel}:`, error);
      }
    }

    return notification;
  }

  async markAsRead(tenantId: string, id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(tenantId: string, userId?: string) {
    const where: any = {
      tenantId,
      isRead: false,
      ...(userId && { userId }),
    };

    await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    return { message: 'All notifications marked as read' };
  }

  async remove(tenantId: string, id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  async getTemplates(tenantId: string) {
    return this.prisma.notificationTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(tenantId: string, dto: {
    name: string;
    type: string;
    subject?: string;
    body: string;
    variables?: string[];
  }) {
    return this.prisma.notificationTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type as any,
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables || [],
      },
    });
  }

  async sendTemplated(tenantId: string, templateId: string, data: Record<string, any>, userId?: string) {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Replace variables
    let body = template.body;
    if (template.variables) {
      for (const variable of template.variables) {
        body = body.replace(new RegExp(`{{${variable}}}`, 'g'), data[variable] || '');
      }
    }

    return this.send({
      tenantId,
      userId,
      type: template.type,
      title: template.subject || template.name,
      message: body,
      data,
    });
  }

  private async sendToChannel(channel: string, dto: SendNotificationDto) {
    switch (channel) {
      case 'EMAIL':
        await this.sendEmail(dto);
        break;
      case 'SMS':
        await this.sendSMS(dto);
        break;
      case 'PUSH':
        await this.sendPush(dto);
        break;
      case 'IN_APP':
        // Already stored in DB
        break;
    }
  }

  private async sendEmail(dto: SendNotificationDto) {
    // Email provider integration point
    this.logger.log(`Email sent: ${dto.title}`);
  }

  private async sendSMS(dto: SendNotificationDto) {
    // SMS provider integration point
    this.logger.log(`SMS sent: ${dto.title}`);
  }

  private async sendPush(dto: SendNotificationDto) {
    // Push notification integration point
    this.logger.log(`Push sent: ${dto.title}`);
  }
}
