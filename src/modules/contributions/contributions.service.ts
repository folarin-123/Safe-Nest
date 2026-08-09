import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { calculateRequiredContribution } from '../goals/goals.utils';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(goalId: string, userId: string, dto: CreateContributionDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot contribute to a goal that is not active');
    }

    const newCurrentAmount = Number(goal.currentAmount) + dto.amount;

    let requiredContribution: number;
    try {
      requiredContribution = calculateRequiredContribution(
        Number(goal.targetAmount),
        newCurrentAmount,
        goal.deadline,
        goal.contributionFrequency as 'daily' | 'weekly' | 'monthly',
      );
    } catch (err) {
      // Deadline has passed — still record the contribution, just can't recalculate a future plan
      requiredContribution = 0;
    }

    const isGoalComplete = newCurrentAmount >= Number(goal.targetAmount);

    const [contribution, updatedGoal] = await this.prisma.$transaction([
      this.prisma.contribution.create({
        data: {
          goalId,
          userId,
          amount: dto.amount,
          contributionDate: new Date(dto.contributionDate),
          sourceType: dto.sourceType,
          externalReference: dto.externalReference,
        },
      }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          requiredContribution,
          status: isGoalComplete ? 'COMPLETED' : goal.status,
        },
      }),
    ]);

    return {
      contribution,
      goal: updatedGoal,
      goalCompleted: isGoalComplete,
    };
  }

  async findAllForGoal(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return this.prisma.contribution.findMany({
      where: { goalId },
      orderBy: { contributionDate: 'desc' },
    });
  }
}
