import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async send(
    userId: string,
    type: NotificationType | string,
    message: string,
    goalId?: string,
    scheduledFor?: Date,
  ) {
    this.logger.log(`Notification to user ${userId}: [${type}] ${message}`);

    const notification = await this.prisma.notificationLog.create({
      data: {
        userId,
        goalId: goalId ?? null,
        type: type as NotificationType,
        message,
        isRead: false,
        scheduledFor: scheduledFor ?? null,
      },
    });

    if (type === NotificationType.ALERT || type === 'ALERT') {
      void this.analyticsService.trackEvent('alert_triggered', {
        alert_type: type,
        severity_level: null,
        location_id: null,
        timestamp: new Date().toISOString(),
      }, userId);
    }

    return notification;
  }

  async findAllForUser(userId: string) {
    const notifications = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      scheduledFor: n.scheduledFor ? n.scheduledFor.toISOString() : null,
    }));
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notificationLog.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notificationLog.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }
}