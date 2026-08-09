import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

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
        isActive: true,
        goals: { some: { status: 'active' } },
      },
      include: {
        goals: { where: { status: 'active' } },
        settings: true,
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

    return {
      usersEvaluated: usersWithActiveGoals.length,
      remindersSent: sentCount,
    };
  }

  private async maybeSendReminder(user: {
    id: string;
    firstName: string | null;
    goals: { goalName: string; requiredContribution: any }[];
    settings: { theme?: string } | null;
  }): Promise<boolean> {
    const frequency = 'weekly';
    const frequencyDays = FREQUENCY_DAYS[frequency];

    const lastReminder = await this.prisma.notificationLog.findFirst({
      where: { userId: user.id, type: 'reminder' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastReminder) {
      const daysSince =
        (Date.now() - lastReminder.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < frequencyDays) {
        return false; // not due yet
      }
    }

    const goalSummaries = user.goals
      .map(
        (g) =>
          `${g.goalName}: ₦${Number(g.requiredContribution ?? 0).toLocaleString()} needed this period`,
      )
      .join('; ');

    await this.notificationsService.send(
      user.id,
      'reminder',
      'Time to save toward your goals',
      `Hi ${user.firstName ?? 'there'}, here's a reminder on your active savings goals — ${goalSummaries}.`,
    );

    return true;
  }
}