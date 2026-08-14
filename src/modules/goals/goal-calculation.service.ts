import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildGoalPlan,
  buildGoalResponse,
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

  /**
   * calculateGoalProgress(goalId)
   * PRD: Calculation of days/months remaining, progress percentage,
   * required contribution, and expected completion.
   */
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

  /**
   * calculateGoalHealthScore(goalId)
   * PRD: Evaluates progress based on contribution consistency, time elapsed
   * vs remaining, and target variance. Persists score and status back to DB.
   */
  async calculateGoalHealthScore(
    goalId: string,
    userId: string,
  ): Promise<GoalHealthResult & { goalId: string }> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    const serialized = serializeGoalDecimal(goal as unknown as Record<string, unknown>);
    const plan = buildGoalPlan({
      targetAmount: serialized['targetAmount'] as number,
      currentAmount: serialized['currentAmount'] as number,
      deadline: serialized['deadline'] as Date,
      contributionFrequency: serialized['contributionFrequency'] as string,
      createdAt: serialized['createdAt'] as Date,
    });

    const health = calculateGoalHealthScore(plan, serialized['targetAmount'] as number);

    await this.prisma.goal.update({
      where: { id: goalId },
      data: { goalHealthScore: health.score, status: health.status as any },
    });

    return { goalId, ...health };
  }

  /**
   * generateSmartRecoveryPlan(goalId, missedAmount)
   * PRD: When a contribution is missed, recalculates future required savings
   * schedule without changing the goal's deadline or target amount.
   */
  async generateSmartRecoveryPlan(
    goalId: string,
    userId: string,
    missedAmount: number,
  ): Promise<SmartRecoveryPlan> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    const serialized = serializeGoalDecimal(goal as unknown as Record<string, unknown>);

    const targetAmount = serialized['targetAmount'] as number;
    const currentAmount = serialized['currentAmount'] as number;
    const deadline = serialized['deadline'] as Date;
    const frequency = normalizeFrequency(serialized['contributionFrequency'] as string);

    // Effective current amount after accounting for the missed contribution
    const effectiveCurrentAmount = Math.max(0, currentAmount - missedAmount);
    const newRequiredContribution = calculateRequiredContribution(
      targetAmount,
      effectiveCurrentAmount,
      deadline,
      frequency,
    );

    const plan = buildGoalPlan({
      targetAmount,
      currentAmount: effectiveCurrentAmount,
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

  /**
   * simulateGoalScenario(targetAmount, deadline, frequency)
   * PRD: Stateless what-if projection given target, deadline, and frequency.
   * Does NOT read or write to the database.
   */
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
