import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { EmailService } from '../../common/email/email.service';

interface ReminderGoalSummary {
  name: string;
  requiredAmount: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly emailService: EmailService,
  ) {}

  async send(
    userId: string,
    type: NotificationType | string,
    message: string,
    goalId?: string,
    scheduledFor?: Date,
    /** Optional pre-computed goal summaries — avoids re-querying goals when the
     *  caller (e.g. RemindersService) already has them loaded. */
    reminderGoals?: ReminderGoalSummary[],
  ) {
    this.logger.log(`Notification to user ${userId}: [${type}] ${message}`);

    const preference = this.preferenceForType(type);
    if (preference) {
      const settings = await this.prisma.userSettings.findUnique({
        where: { userId },
        select: {
          contributionReminder: true,
          missedContributionAlert: true,
          milestoneCelebration: true,
          smartInsights: true,
          emailUpdate: true,
        },
      });
      if (settings && !settings[preference]) return null;
    }

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

    // Fire off the email in the background — a failed email must never break
    // the notification log write above, which has already succeeded.
    if (type === NotificationType.REMINDER || type === 'REMINDER') {
      void this.sendReminderEmail(userId, reminderGoals).catch((error: unknown) => {
        this.logger.warn(
          `Reminder email could not be sent to user ${userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    return notification;
  }

  private preferenceForType(
    type: NotificationType | string,
  ): 'contributionReminder' | 'missedContributionAlert' | 'milestoneCelebration' | 'smartInsights' | 'emailUpdate' | null {
    switch (type) {
      case NotificationType.REMINDER:
      case 'REMINDER': return 'contributionReminder';
      case NotificationType.ALERT:
      case 'ALERT':
      case NotificationType.SECURITY:
      case 'SECURITY': return 'missedContributionAlert';
      case NotificationType.MILESTONE:
      case 'MILESTONE': return 'milestoneCelebration';
      case NotificationType.SMART_INSIGHT:
      case 'SMART_INSIGHT': return 'smartInsights';
      case NotificationType.EMAIL_UPDATE:
      case 'EMAIL_UPDATE': return 'emailUpdate';
      default: return null;
    }
  }

  private async sendReminderEmail(
    userId: string,
    reminderGoals?: ReminderGoalSummary[],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        settings: { select: { emailEnabled: true, contributionReminder: true } },
      },
    });

    if (!user) return;

    // Respect the user's email preference explicitly. Only skip if they have
    // settings AND have explicitly turned email off — default (no settings
    // row, or emailEnabled true) is to send.
    if (user.settings && (!user.settings.emailEnabled || !user.settings.contributionReminder)) {
      return;
    }

    const firstName = user.fullName?.trim().split(/\s+/)[0] || 'there';

    const goals =
      reminderGoals ??
      (await this.getActiveGoalSummariesForUser(userId));

    await this.emailService.sendTemplate(user.email, 'reminder', {
      firstName,
      goals,
    });
  }

  private async getActiveGoalSummariesForUser(
    userId: string,
  ): Promise<ReminderGoalSummary[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { goalName: true, requiredContribution: true },
    });

    return goals.map((g) => ({
      name: g.goalName,
      requiredAmount: `₦${Number(g.requiredContribution ?? 0).toLocaleString()}`,
    }));
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