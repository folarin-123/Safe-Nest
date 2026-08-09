import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(userId: string, type: string, subject: string, body: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const emailEnabled = settings?.emailNotifications ?? true;
    const pushEnabled = settings?.pushNotifications ?? true;

    if (!emailEnabled && !pushEnabled) {
      this.logger.log(`Skipped notification for user ${userId} — notifications disabled`);
      return null;
    }

    // Placeholder delivery — logs for now. Swap this for a real provider
    // (SendGrid, Firebase Cloud Messaging, etc.) when you're ready to wire one up.
    this.logger.log(`Notification to user ${userId}: [${type}] ${subject}`);

    return this.prisma.notificationLog.create({
      data: {
        userId,
        type,
        subject,
        body,
        status: 'sent',
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    });
  }
}