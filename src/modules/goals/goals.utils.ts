
export type ContributionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type GoalPlanStatus = 'ACTIVE' | 'AT_RISK' | 'OFF_TRACK' | 'ACHIEVED';

export type GoalHealthLabel = 'HEALTHY' | 'AT_RISK' | 'OFF_TRACK';

export interface GoalPlan {
  amountRemaining: number;
  daysRemaining: number;
  monthsRemaining: number;
  progressPercentage: number;
  requiredContribution: number;
  status: GoalPlanStatus;
  expectedAmountByNow: number;
  isOnTrack: boolean;
  periodsRemaining: number;
  totalPeriods: number;
  elapsedPeriods: number;
}

export interface GoalHealthResult {
 
  score: number;
  label: GoalHealthLabel;
  status: GoalPlanStatus;
}

interface GoalPlanInput {
  targetAmount: number | string | { toString(): string } | null | undefined;
  currentAmount: number | string | { toString(): string } | null | undefined;
  deadline: Date | string | null | undefined;
  contributionFrequency: ContributionFrequency | string | null | undefined;
  preferredContribution?: number | string | { toString(): string } | null | undefined;
  createdAt?: Date | string | null | undefined;
}


export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && 'toString' in (value as object)) {
    const n = Number((value as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}

export function normalizeFrequency(
  frequency: ContributionFrequency | string | null | undefined,
): ContributionFrequency {
  if (!frequency) return 'MONTHLY';
  const upper = String(frequency).toUpperCase();
  if (upper === 'DAILY' || upper === 'WEEKLY' || upper === 'MONTHLY') {
    return upper as ContributionFrequency;
  }
  return 'MONTHLY';
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateDayDifference(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

function calculatePeriodsBetween(
  start: Date,
  end: Date,
  frequency: ContributionFrequency,
): number {
  const days = calculateDayDifference(start, end);
  if (days <= 0) return 0;
  switch (frequency) {
    case 'DAILY':  return days;
    case 'WEEKLY': return Math.max(1, Math.ceil(days / 7));
    case 'MONTHLY': return Math.max(1, Math.ceil(days / 30));
  }
}


export function calculatePeriodsUntilDeadline(
  deadline: Date,
  frequency: ContributionFrequency,
): number {
  const now = new Date();
  const daysRemaining = calculateDayDifference(now, deadline);
  if (daysRemaining <= 0) return 1; 
  return calculatePeriodsBetween(now, deadline, frequency);
}


export function calculateRequiredContribution(
  targetAmount: number,
  currentAmount: number,
  deadline: Date,
  frequency: ContributionFrequency | string,
): number {
  const remaining = Math.max(0, targetAmount - currentAmount);
  if (remaining <= 0) return 0;
  const freq = normalizeFrequency(frequency);
  const periods = calculatePeriodsUntilDeadline(deadline, freq);
  return roundCurrency(remaining / periods);
}

export function assessFeasibility(
  requiredContribution: number,
  preferredContribution?: number,
): { feasible: boolean; shortfallPerPeriod: number } {
  if (preferredContribution === undefined) return { feasible: true, shortfallPerPeriod: 0 };
  const shortfall = requiredContribution - preferredContribution;
  return {
    feasible: shortfall <= 0,
    shortfallPerPeriod: shortfall > 0 ? roundCurrency(shortfall) : 0,
  };
}


export function buildGoalPlan(input: GoalPlanInput): GoalPlan {
  const targetAmount = toNumber(input.targetAmount);
  const currentAmount = toNumber(input.currentAmount);
  const deadline = normalizeDate(input.deadline);
  const frequency = normalizeFrequency(input.contributionFrequency);
  const createdAt = normalizeDate(input.createdAt);
  const now = new Date();

  const amountRemaining = Math.max(0, targetAmount - currentAmount);
  const progressPercentage =
    targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

  const periodsRemaining = calculatePeriodsUntilDeadline(deadline, frequency);
  const requiredContribution =
    amountRemaining > 0 ? roundCurrency(amountRemaining / periodsRemaining) : 0;

  const daysRemaining = Math.max(0, calculateDayDifference(now, deadline));
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30));

  const totalPeriods = calculatePeriodsBetween(createdAt, deadline, frequency);
  const elapsedPeriods = calculatePeriodsBetween(createdAt, now, frequency);
  const cappedElapsed = totalPeriods > 0 ? Math.min(elapsedPeriods, totalPeriods) : 0;
  const expectedAmountByNow =
    totalPeriods > 0 ? roundCurrency((targetAmount / totalPeriods) * cappedElapsed) : 0;

  const isAchieved = amountRemaining <= 0;
  const isOverdue = !isAchieved && daysRemaining <= 0;
  const isOnTrack = isAchieved || (!isOverdue && currentAmount >= expectedAmountByNow);

  let status: GoalPlanStatus;
  if (isAchieved) {
    status = 'ACHIEVED';
  } else if (isOverdue) {
    status = 'OFF_TRACK';
  } else if (!isOnTrack) {
    const deficitRatio =
      expectedAmountByNow > 0
        ? (expectedAmountByNow - currentAmount) / expectedAmountByNow
        : 0;
    status = deficitRatio > 0.25 ? 'OFF_TRACK' : 'AT_RISK';
  } else {
    status = 'ACTIVE';
  }

  return {
    amountRemaining: roundCurrency(amountRemaining),
    daysRemaining,
    monthsRemaining,
    progressPercentage,
    requiredContribution,
    status,
    expectedAmountByNow: roundCurrency(expectedAmountByNow),
    isOnTrack,
    periodsRemaining,
    totalPeriods,
    elapsedPeriods,
  };
}


export function calculateGoalHealthScore(plan: GoalPlan, targetAmount: number): GoalHealthResult {
  if (plan.status === 'ACHIEVED') {
    return { score: 100, label: 'HEALTHY', status: 'ACHIEVED' };
  }

  // 1. Progress vs time (0–40)
  const timeElapsedRatio =
    plan.totalPeriods > 0 ? Math.min(1, plan.elapsedPeriods / plan.totalPeriods) : 0;
  const progressRatio =
    targetAmount > 0
      ? Math.min(1, (targetAmount - plan.amountRemaining) / targetAmount)
      : 0;
  const progressScore =
    timeElapsedRatio === 0
      ? 40 
      : Math.min(40, Math.round((progressRatio / timeElapsedRatio) * 40));


  const remainingRatio =
    plan.totalPeriods > 0 ? plan.periodsRemaining / plan.totalPeriods : 0;
  const cushionScore = Math.round(Math.min(1, remainingRatio / 0.6) * 30);

  const actualSaved = targetAmount - plan.amountRemaining;
  const deficitScore =
    plan.expectedAmountByNow <= 0
      ? 30
      : Math.round(Math.min(1, actualSaved / plan.expectedAmountByNow) * 30);

  const score = Math.max(0, Math.min(100, progressScore + cushionScore + deficitScore));

  let label: GoalHealthLabel;
  let status: GoalPlanStatus;
  if (score >= 70) {
    label = 'HEALTHY';
    status = 'ACTIVE';
  } else if (score >= 40) {
    label = 'AT_RISK';
    status = 'AT_RISK';
  } else {
    label = 'OFF_TRACK';
    status = 'OFF_TRACK';
  }

  return { score, label, status };
}


export function serializeGoalDecimal(goal: Record<string, unknown>): Record<string, unknown> {
  return {
    ...goal,
    targetAmount: toNumber(goal['targetAmount']),
    currentAmount: toNumber(goal['currentAmount']),
    preferredContribution:
      goal['preferredContribution'] == null ? null : toNumber(goal['preferredContribution']),
    requiredContribution:
      goal['requiredContribution'] == null ? null : toNumber(goal['requiredContribution']),
    goalHealthScore:
      goal['goalHealthScore'] == null ? null : toNumber(goal['goalHealthScore']),
    deadline: goal['deadline'] ? new Date(goal['deadline'] as string) : null,
    createdAt: goal['createdAt'] ? new Date(goal['createdAt'] as string) : null,
  };
}

export function buildGoalResponse(goal: Record<string, unknown>) {
  const serialized = serializeGoalDecimal(goal);
  const plan = buildGoalPlan({
    targetAmount: serialized['targetAmount'] as number,
    currentAmount: serialized['currentAmount'] as number,
    deadline: serialized['deadline'] as Date | null,
    contributionFrequency: serialized['contributionFrequency'] as string,
    preferredContribution: (serialized['preferredContribution'] as number | null) ?? undefined,
    createdAt: serialized['createdAt'] as Date | null,
  });

  const health = calculateGoalHealthScore(plan, serialized['targetAmount'] as number);
  const feasibility = assessFeasibility(
    plan.requiredContribution,
    (serialized['preferredContribution'] as number | null) ?? undefined,
  );

  return {
    ...serialized,
    progressPercentage: plan.progressPercentage,
    goalHealthScore: serialized['goalHealthScore'] ?? health.score,
    healthLabel: health.label,
    plan,
    feasibility,
  };
}