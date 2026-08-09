import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { assessFeasibility, buildGoalPlan, calculateRequiredContribution } from '../goals/goals.utils';

@Injectable()
export class ContributionsService {
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

    return {
      ...serializedGoal,
      progressPercentage: plan.progressPercentage,
      plan,
      feasibility: assessFeasibility(
        plan.requiredContribution,
        serializedGoal.preferredContribution ?? undefined,
      ),
    };
  }

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
    const requiredContribution = calculateRequiredContribution(
      Number(goal.targetAmount),
      newCurrentAmount,
      goal.deadline,
      goal.contributionFrequency as 'daily' | 'weekly' | 'monthly',
    );

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
      contribution: {
        ...contribution,
        amount: Number(contribution.amount ?? 0),
      },
      goal: this.buildGoalResponse(updatedGoal),
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

    const contributions = await this.prisma.contribution.findMany({
      where: { goalId },
      orderBy: { contributionDate: 'desc' },
    });

    return contributions.map((contribution) => ({
      ...contribution,
      amount: Number(contribution.amount ?? 0),
    }));
  }
}
