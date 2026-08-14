import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildGoalPlan,
  calculateGoalHealthScore,
  calculateRequiredContribution,
  normalizeFrequency,
  serializeGoalDecimal,
  type ContributionFrequency,
  type GoalHealthResult,
  type GoalPlan,
} from './goals.utils';

export interface SmartRecoveryPlan {
  goalId: string;
  missedAmount: number;
  newRequiredContribution: number;
  periodsRemaining: number;
  catchUpNote: string;
  updatedHealth: GoalHealthResult;
  plan: GoalPlan;
}

export interface ScenarioResult {
  targetAmount: number;
  deadline: string;
  frequency: ContributionFrequency;
  requiredContributionPerPeriod: number;
  totalPeriods: number;
  feasible: boolean;
  plan: GoalPlan;
}

@Injectable()
export class GoalCalculationService {
  constructor(private readonly prisma: PrismaService) {}


  async calculateGoalProgress(goalId: string, userId: string) {
    const goal = await this.findGoalOrThrow(goalId, userId);
    const serialized = serializeGoalDecimal(goal as unknown as Record<string, unknown>);
    const plan = buildGoalPlan({
      targetAmount: serialized['targetAmount'] as number,
      currentAmount: serialized['currentAmount'] as number,
      deadline: serialized['deadline'] as Date,
      contributionFrequency: serialized['contributionFrequency'] as string,
      preferredContribution: (serialized['preferredContribution'] as number | null) ?? undefined,
      createdAt: serialized['createdAt'] as Date,
    });

    return {
      goalId: goal.id,
      goalName: goal.goalName,
      targetAmount: serialized['targetAmount'],
      currentAmount: serialized['currentAmount'],
      progressPercentage: plan.progressPercentage,
      amountRemaining: plan.amountRemaining,
      requiredContribution: plan.requiredContribution,
      daysRemaining: plan.daysRemaining,
      monthsRemaining: plan.monthsRemaining,
      periodsRemaining: plan.periodsRemaining,
      totalPeriods: plan.totalPeriods,
      elapsedPeriods: plan.elapsedPeriods,
      expectedAmountByNow: plan.expectedAmountByNow,
      isOnTrack: plan.isOnTrack,
      status: plan.status,
    };
  }

  
  async calculateGoalHealthScore(
    goalId: string,
    userId: string,
  ): Promise<GoalHealthResult & { goalId: string }> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    if (goal.status === GoalStatus.ACHIEVED) {
      return { goalId, score: 100, label: 'HEALTHY', status: 'ACHIEVED' };
    }
    const serialized = serializeGoalDecimal(goal as unknown as Record<string, unknown>);
    const plan = buildGoalPlan({
      targetAmount: serialized['targetAmount'] as number,
      currentAmount: serialized['currentAmount'] as number,
      deadline: serialized['deadline'] as Date,
      contributionFrequency: serialized['contributionFrequency'] as string,
      createdAt: serialized['createdAt'] as Date,
    });

    const health = calculateGoalHealthScore(plan, serialized['targetAmount'] as number);

    await this.prisma.goal.updateMany({
      where: { id: goalId, userId, status: { not: GoalStatus.ACHIEVED } },
      data: { goalHealthScore: health.score, status: health.status as GoalStatus },
    });

    return { goalId, ...health };
  }


  async generateSmartRecoveryPlan(
    goalId: string,
    userId: string,
    missedAmount: number,
  ): Promise<SmartRecoveryPlan> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    if (goal.status === GoalStatus.ACHIEVED) {
      const plan = buildGoalPlan({ targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, deadline: goal.deadline, contributionFrequency: goal.contributionFrequency, createdAt: goal.createdAt });
      return { goalId, missedAmount, newRequiredContribution: 0, periodsRemaining: 0, catchUpNote: 'This goal has already been achieved.', updatedHealth: { score: 100, label: 'HEALTHY', status: 'ACHIEVED' }, plan };
    }
    const serialized = serializeGoalDecimal(goal as unknown as Record<string, unknown>);

    const targetAmount = serialized['targetAmount'] as number;
    const currentAmount = serialized['currentAmount'] as number;
    const deadline = serialized['deadline'] as Date;
    const frequency = normalizeFrequency(serialized['contributionFrequency'] as string);


    const newRequiredContribution = calculateRequiredContribution(
      targetAmount,
      currentAmount,
      deadline,
      frequency,
    );

    const plan = buildGoalPlan({
      targetAmount,
      currentAmount,
      deadline,
      contributionFrequency: frequency,
      createdAt: serialized['createdAt'] as Date,
    });

    const health = calculateGoalHealthScore(plan, targetAmount);

    return {
      goalId,
      missedAmount,
      newRequiredContribution,
      periodsRemaining: plan.periodsRemaining,
      catchUpNote:
        `Missed ₦${missedAmount.toLocaleString()}. New required: ` +
        `₦${newRequiredContribution.toLocaleString()} per ${frequency.toLowerCase()} ` +
        `over ${plan.periodsRemaining} remaining period(s).`,
      updatedHealth: health,
      plan,
    };
  }

  
  
  simulateGoalScenario(
    targetAmount: number,
    deadline: string,
    frequency: ContributionFrequency | string,
    currentAmount = 0,
  ): ScenarioResult {
    const deadlineDate = new Date(deadline);
    const freq = normalizeFrequency(frequency);

    const plan = buildGoalPlan({
      targetAmount,
      currentAmount,
      deadline: deadlineDate,
      contributionFrequency: freq,
      createdAt: new Date(),
    });

    const requiredContributionPerPeriod = calculateRequiredContribution(
      targetAmount,
      currentAmount,
      deadlineDate,
      freq,
    );

    return {
      targetAmount,
      deadline,
      frequency: freq,
      requiredContributionPerPeriod,
      totalPeriods: plan.totalPeriods,
      feasible: plan.daysRemaining > 0,
      plan,
    };
  }

  private async findGoalOrThrow(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }
}
