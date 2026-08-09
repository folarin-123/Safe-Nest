import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSummary(userId: string) {
    const totalSavedResult = await this.prisma.goal.aggregate({
      where: { userId },
      _sum: { currentAmount: true },
    });

    const activeGoalCount = await this.prisma.goal.count({
      where: { userId, status: 'ACTIVE' },
    });

    const completedGoalCount = await this.prisma.goal.count({
      where: { userId, status: 'COMPLETED' },
    });

    const totalGoals = await this.prisma.goal.count({
      where: { userId },
    });

    const completionRate = totalGoals > 0 ? (completedGoalCount / totalGoals) * 100 : 0;

    return {
      totalSaved: Number(totalSavedResult._sum.currentAmount ?? 0),
      activeGoals: activeGoalCount,
      completedGoals: completedGoalCount,
      totalGoals,
      completionRate: Number(completionRate.toFixed(2)),
    };
  }
}
