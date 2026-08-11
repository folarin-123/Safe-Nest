import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import {
  buildGoalResponse,
  buildGoalPlan,
  calculateGoalHealthScore,
  calculateRequiredContribution,
} from '../goals/goals.utils';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /api/v1/goals/:id/contributions — Record manual or synced contribution */
  async create(goalId: string, userId: string, dto: CreateContributionDto) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });

    if (!goal) throw new NotFoundException('Goal not found');

    if (goal.status === 'ACHIEVED') {
      throw new BadRequestException('Cannot contribute to an already achieved goal');
    }

    const newCurrentAmount = Number(goal.currentAmount) + dto.amount;
    const targetAmount = Number(goal.targetAmount);
    const isAchieved = newCurrentAmount >= targetAmount;

    const newRequiredContribution = isAchieved
      ? 0
      : calculateRequiredContribution(
          targetAmount,
          newCurrentAmount,
          goal.deadline,
          goal.contributionFrequency,
        );

    // Recompute health score after contribution
    const plan = buildGoalPlan({
      targetAmount,
      currentAmount: newCurrentAmount,
      deadline: goal.deadline,
      contributionFrequency: goal.contributionFrequency,
      createdAt: goal.createdAt,
    });
    const health = calculateGoalHealthScore(plan, targetAmount);

    const [contribution, updatedGoal] = await this.prisma.$transaction([
      this.prisma.contribution.create({
        data: {
          goalId,
          userId,
          amount: dto.amount,
          contributionDate: new Date(dto.contributionDate),
          trackingType: dto.trackingType,
          externalReference: dto.externalReference,
        },
      }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          requiredContribution: newRequiredContribution,
          goalHealthScore: health.score,
          status: isAchieved ? 'ACHIEVED' : (health.status as any),
        },
      }),
    ]);

    return {
      contribution: { ...contribution, amount: Number(contribution.amount ?? 0) },
      goal: buildGoalResponse(updatedGoal as unknown as Record<string, unknown>),
      goalAchieved: isAchieved,
    };
  }

  async findAllForGoal(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');

    const contributions = await this.prisma.contribution.findMany({
      where: { goalId },
      orderBy: { contributionDate: 'desc' },
    });

    return contributions.map((c) => ({ ...c, amount: Number(c.amount ?? 0) }));
  }
}
