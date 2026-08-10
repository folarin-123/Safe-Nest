import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(userId: string, type: string, subject: string, body: string) {
    // Placeholder delivery — logs for now. Replace this with a real provider when ready.
    this.logger.log(`Notification to user ${userId}: [${type}] ${subject}`);

    const message = subject ? `${subject}\n\n${body}` : body;

    return this.prisma.notificationLog.create({
      data: {
        userId,
        type,
        message,
        status: 'UNREAD',
      },
    });
  }

  async findAllForUser(userId: string) {
    const notifications = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    }));
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notificationLog.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notificationLog.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });
  }
}
