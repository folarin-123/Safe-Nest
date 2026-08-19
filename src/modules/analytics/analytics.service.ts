import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(
    eventName: string,
    properties: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: { eventName, userId: userId ?? null, properties: properties as Prisma.InputJsonValue },
      });
    } catch (error) {
      this.logger.warn(
        `Analytics event ${eventName} could not be recorded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  trackCoreFeature(
    userId: string,
    featureName: string,
    interactionType: string,
  ): void {
    void this.trackEvent('core_feature_clicked', {
      feature_name: featureName,
      interaction_type: interactionType,
      user_id: userId,
    }, userId);
  }

  /**
   * GET /api/v1/dashboard/summary
   *
   * PRD required metrics:
   * - Total Active Goals
   * - Total Target Value
   * - Total Progress Amount
   * - Overall Progress %
   * - Count of Goals At Risk (AT_RISK or OFF_TRACK)
   * - Upcoming Major Financial Commitments (goals due within 30 days)
   */
  async getDashboardSummary(userId: string) {
    const [goals, aggregates] = await Promise.all([
      this.prisma.goal.findMany({
        where: { userId },
        select: {
          id: true,
          goalName: true,
          status: true,
          targetAmount: true,
          currentAmount: true,
          requiredContribution: true,
          deadline: true,
        },
      }),
      this.prisma.goal.aggregate({
        where: { userId },
        _sum: { targetAmount: true, currentAmount: true },
        _count: { id: true },
      }),
    ]);

    const totalGoals = aggregates._count.id;
    const totalTargetValue = Number(aggregates._sum.targetAmount ?? 0);
    const totalProgressAmount = Number(aggregates._sum.currentAmount ?? 0);
    const overallProgressPercentage =
      totalTargetValue > 0
        ? Math.round((totalProgressAmount / totalTargetValue) * 10000) / 100
        : 0;

    const totalActiveGoals = goals.filter((g) => g.status === 'ACTIVE').length;
    const goalsAtRiskCount = goals.filter(
      (g) => g.status === 'AT_RISK' || g.status === 'OFF_TRACK',
    ).length;

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingCommitments = goals
      .filter((g) => g.status !== 'ACHIEVED' && g.deadline > now && g.deadline <= in30Days)
      .map((g) => ({
        goalId: g.id,
        goalName: g.goalName,
        deadline: g.deadline.toISOString().split('T')[0],
        daysUntilDeadline: Math.ceil((g.deadline.getTime() - now.getTime()) / 86_400_000),
        amountRemaining: Math.max(0, Number(g.targetAmount) - Number(g.currentAmount)),
        requiredContribution: g.requiredContribution ? Number(g.requiredContribution) : null,
        status: g.status,
      }))
      .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);

    return {
      totalActiveGoals,
      totalTargetValue,
      totalProgressAmount,
      overallProgressPercentage,
      goalsAtRiskCount,
      upcomingCommitments,
    };
  }
}
