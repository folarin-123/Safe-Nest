import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountStatus, GoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateRequiredContribution } from '../goals/goals.utils';
import { NotificationsService } from './notifications.service';

type ReminderUser = Prisma.UserGetPayload<{ include: { settings: true; goals: true } }>;
const REMINDABLE_STATUSES = [GoalStatus.ACTIVE, GoalStatus.AT_RISK, GoalStatus.OFF_TRACK];

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  constructor(private readonly prisma: PrismaService, private readonly notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scheduledReminderCheck() { await this.runReminderCheck(); }

  async runReminderCheck() {
    this.logger.log('Running reminder check');
    const users = await this.prisma.user.findMany({
      where: { status: AccountStatus.ACTIVE, goals: { some: { status: { in: REMINDABLE_STATUSES } } } },
      include: { goals: { where: { status: { in: REMINDABLE_STATUSES } } }, settings: true },
    });
    let remindersSent = 0;
    let failures = 0;
    for (const user of users) {
      try {
        if (await this.maybeSendReminder(user)) remindersSent++;
      } catch (error) {
        failures++;
        this.logger.error(`Reminder processing failed for user ${user.id}`, error instanceof Error ? error.stack : String(error));
      }
    }
    this.logger.log(`Reminder check complete: evaluated=${users.length}, sent=${remindersSent}, failed=${failures}`);
    return { usersEvaluated: users.length, remindersSent, failures };
  }

  private async maybeSendReminder(user: ReminderUser): Promise<boolean> {
    if (user.settings && !user.settings.pushEnabled && !user.settings.emailEnabled) return false;
    const lastReminder = await this.prisma.notificationLog.findFirst({ where: { userId: user.id, type: 'REMINDER' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    if (lastReminder && Date.now() - lastReminder.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) return false;

    const goalSummaries = user.goals.map((goal) => {
      const required = calculateRequiredContribution(goal.targetAmount, goal.currentAmount, goal.deadline, goal.contributionFrequency);
      return `${goal.goalName}: ₦${required.toLocaleString()} needed this period`;
    });
    if (goalSummaries.length === 0) return false;
    await this.notificationsService.send(user.id, 'REMINDER', `Hi ${user.firstName ?? 'there'}, here's your savings reminder — ${goalSummaries.join('; ')}.`);
    return true;
  }
}
