import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import {
  assessFeasibility,
  buildGoalPlan,
  calculateRequiredContribution,
} from './goals.utils';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeGoal(goal: any) {
    return {
      ...goal,
      targetAmount: Number(goal.targetAmount ?? 0),
      currentAmount: Number(goal.currentAmount ?? 0),
      preferredContribution:
        goal.preferredContribution === null || goal.preferredContribution === undefined
          ? null
          : Number(goal.preferredContribution),
      requiredContribution:
        goal.requiredContribution === null || goal.requiredContribution === undefined
          ? null
          : Number(goal.requiredContribution),
      deadline: goal.deadline ? new Date(goal.deadline) : null,
      createdAt: goal.createdAt ? new Date(goal.createdAt) : null,
    };
  }

  private buildGoalResponse(goal: any) {
    const serializedGoal = this.serializeGoal(goal);
    const plan = buildGoalPlan({
      targetAmount: serializedGoal.targetAmount,
      currentAmount: serializedGoal.currentAmount,
      deadline: serializedGoal.deadline,
      contributionFrequency: serializedGoal.contributionFrequency,
      preferredContribution: serializedGoal.preferredContribution ?? undefined,
      createdAt: serializedGoal.createdAt,
    });

    const feasibility = assessFeasibility(
      plan.requiredContribution,
      serializedGoal.preferredContribution ?? undefined,
    );

    return {
      ...serializedGoal,
      progressPercentage: plan.progressPercentage,
      plan,
      feasibility,
    };
  }

  async create(userId: string, dto: CreateGoalDto) {
    const deadline = new Date(dto.deadline);

    const requiredContribution = calculateRequiredContribution(
      dto.targetAmount,
      0,
      deadline,
      dto.contributionFrequency,
    );

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

    return this.buildGoalResponse(goal);
  }

  async recalculate(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new BadRequestException('Goal not found');
    }

    const requiredContribution = calculateRequiredContribution(
      Number(goal.targetAmount),
      Number(goal.currentAmount),
      goal.deadline,
      goal.contributionFrequency as 'daily' | 'weekly' | 'monthly',
    );

    const updatedGoal = await this.prisma.goal.update({
      where: { id: goalId },
      data: { requiredContribution },
    });

    return this.buildGoalResponse(updatedGoal);
  }

  async findAllForUser(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((goal) => this.buildGoalResponse(goal));
  }

  async findOne(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: { contributions: { orderBy: { contributionDate: 'desc' } } },
    });

    if (!goal) {
      throw new BadRequestException('Goal not found');
    }

    const response = this.buildGoalResponse(goal);

    return {
      ...response,
      contributions: goal.contributions.map((contribution: any) => ({
        ...contribution,
        amount: Number(contribution.amount ?? 0),
      })),
    };
  }
}