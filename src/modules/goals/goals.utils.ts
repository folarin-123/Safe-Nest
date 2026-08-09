export type ContributionFrequency = 'daily' | 'weekly' | 'monthly';

export type GoalPlanStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE';

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

interface GoalPlanInput {
  targetAmount: number | string | { toString(): string } | null | undefined;
  currentAmount: number | string | { toString(): string } | null | undefined;
  deadline: Date | string | null | undefined;
  contributionFrequency: ContributionFrequency | string | null | undefined;
  preferredContribution?: number | string | { toString(): string } | null | undefined;
  createdAt?: Date | string | null | undefined;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'object' && 'toString' in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeDate(value: Date | string | null | undefined): Date {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date(value);
}

function normalizeFrequency(
  frequency: ContributionFrequency | string | null | undefined,
): ContributionFrequency {
  if (frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') {
    return frequency;
  }

  switch (frequency?.toLowerCase()) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    default:
      return 'monthly';
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateDayDifference(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.ceil((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

function calculatePeriodsBetween(
  start: Date,
  end: Date,
  frequency: ContributionFrequency,
): number {
  const days = calculateDayDifference(start, end);

  if (days <= 0) {
    return 0;
  }

  switch (frequency) {
    case 'daily':
      return days;
    case 'weekly':
      return Math.max(1, Math.ceil(days / 7));
    case 'monthly':
      return Math.max(1, Math.ceil(days / 30));
  }
}

/**
 * Calculates how many contribution periods (days/weeks/months) remain
 * between now and the deadline.
 */
export function calculatePeriodsUntilDeadline(
  deadline: Date,
  frequency: ContributionFrequency,
): number {
  const now = new Date();
  const daysRemaining = calculateDayDifference(now, deadline);

  if (daysRemaining <= 0) {
    return 1;
  }

  return calculatePeriodsBetween(now, deadline, frequency);
}

/**
 * Calculates the required contribution per period to reach the target
 * amount by the deadline, given what's already saved.
 */
export function calculateRequiredContribution(
  targetAmount: number,
  currentAmount: number,
  deadline: Date,
  frequency: ContributionFrequency,
): number {
  const remaining = Math.max(0, targetAmount - currentAmount);

  if (remaining <= 0) {
    return 0;
  }

  const periods = calculatePeriodsUntilDeadline(deadline, frequency);
  return roundCurrency(remaining / periods);
}

/**
 * Compares a user's preferred contribution against what's actually
 * required, and returns a feasibility assessment.
 */
export function assessFeasibility(
  requiredContribution: number,
  preferredContribution?: number,
): { feasible: boolean; shortfallPerPeriod: number } {
  if (preferredContribution === undefined) {
    return { feasible: true, shortfallPerPeriod: 0 };
  }

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
  const preferredContribution = input.preferredContribution
    ? toNumber(input.preferredContribution)
    : undefined;
  const createdAt = normalizeDate(input.createdAt);
  const now = new Date();

  const amountRemaining = Math.max(0, targetAmount - currentAmount);
  const progressPercentage =
    targetAmount > 0
      ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
      : 0;
  const periodsRemaining = calculatePeriodsUntilDeadline(deadline, frequency);
  const requiredContribution =
    amountRemaining > 0 ? roundCurrency(amountRemaining / periodsRemaining) : 0;

  const daysRemaining = Math.max(0, calculateDayDifference(now, deadline));
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30));

  const totalPeriods = calculatePeriodsBetween(createdAt, deadline, frequency);
  const elapsedPeriods = calculatePeriodsBetween(createdAt, now, frequency);
  const cappedElapsedPeriods =
    totalPeriods > 0 ? Math.min(elapsedPeriods, totalPeriods) : 0;
  const expectedAmountByNow =
    totalPeriods > 0
      ? roundCurrency((targetAmount / totalPeriods) * cappedElapsedPeriods)
      : 0;

  const isCompleted = amountRemaining <= 0;
  const isOverdue = !isCompleted && daysRemaining <= 0;
  const isOnTrack = isCompleted || (!isOverdue && currentAmount >= expectedAmountByNow);
  const status: GoalPlanStatus = isCompleted ? 'COMPLETED' : isOverdue ? 'OVERDUE' : 'ACTIVE';

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