import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scheduledReminderCheck() {
    await this.runReminderCheck();
  }

  async runReminderCheck() {
    this.logger.log('Running reminder check...');

    const usersWithActiveGoals = await this.prisma.user.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        goals: { some: { status: 'ACTIVE' } },
      },
      include: {
        goals: { where: { status: 'ACTIVE' } },
        settings: {
          select: { contributionReminder: true },
        },
      },
    });

    let sentCount = 0;
    for (const user of usersWithActiveGoals) {
      const sent = await this.maybeSendReminder(user);
      if (sent) sentCount++;
    }

    this.logger.log(
      `Reminder check complete — evaluated ${usersWithActiveGoals.length} users, sent ${sentCount} reminders`,
    );

    return { usersEvaluated: usersWithActiveGoals.length, remindersSent: sentCount };
  }

  private async maybeSendReminder(user: {
    id: string;
    fullName: string;
    goals: { goalName: string; requiredContribution: any }[];
    settings: {
      contributionReminder: boolean;
    } | null;
  }): Promise<boolean> {
    if (user.settings && !user.settings.contributionReminder) {
      return false;
    }

    // Respect weekly reminder cadence
    const lastReminder = await this.prisma.notificationLog.findFirst({
      where: { userId: user.id, type: 'REMINDER' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastReminder) {
      const daysSince =
        (Date.now() - lastReminder.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return false;
    }

    const reminderGoals = user.goals.map((g) => ({
      name: g.goalName,
      requiredAmount: `₦${Number(g.requiredContribution ?? 0).toLocaleString()}`,
    }));

    const goalSummaries = reminderGoals
      .map((g) => `${g.name}: ${g.requiredAmount} needed this period`)
      .join('; ');

    const firstName = user.fullName?.trim().split(/\s+/)[0] || 'there';

    const notification = await this.notificationsService.send(
      user.id,
      'REMINDER',
      `Hi ${firstName}, here's your savings reminder — ${goalSummaries}.`,
      undefined,
      undefined,
      reminderGoals,
    );

    return notification !== null;
  }
}