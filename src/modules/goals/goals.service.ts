import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import {
  calculateRequiredContribution,
  assessFeasibility,
} from './goals.utils';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
    const deadline = new Date(dto.deadline);

    let requiredContribution: number;
    try {
      requiredContribution = calculateRequiredContribution(
        dto.targetAmount,
        0,
        deadline,
        dto.contributionFrequency,
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        goalName: dto.goalName,
        targetAmount: dto.targetAmount,
        deadline,
        contributionFrequency: dto.contributionFrequency,
        preferredContribution: dto.preferredContribution,
        requiredContribution,
        description: dto.description,
      },
    });

    const feasibility = assessFeasibility(
      requiredContribution,
      dto.preferredContribution,
    );

    return { goal, feasibility };
  }

  async recalculate(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new BadRequestException('Goal not found');
    }

    let requiredContribution: number;
    try {
      requiredContribution = calculateRequiredContribution(
        Number(goal.targetAmount),
        Number(goal.currentAmount),
        goal.deadline,
        goal.contributionFrequency as 'daily' | 'weekly' | 'monthly',
      );
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id: goalId },
      data: { requiredContribution },
    });

    const feasibility = assessFeasibility(
      requiredContribution,
      goal.preferredContribution ? Number(goal.preferredContribution) : undefined,
    );

    return { goal: updatedGoal, feasibility };
  }

  async findAllForUser(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: { contributions: { orderBy: { contributionDate: 'desc' } } },
    });

    if (!goal) {
      throw new BadRequestException('Goal not found');
    }

    const progressPercentage =
      Number(goal.targetAmount) > 0
        ? Math.min(
            100,
            Math.round(
              (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100,
            ),
          )
        : 0;

    return { ...goal, progressPercentage };
  }
}