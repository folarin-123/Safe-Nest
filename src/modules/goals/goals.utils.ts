import { Prisma } from '@prisma/client';

export type ContributionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type GoalPlanStatus = 'ACTIVE' | 'AT_RISK' | 'OFF_TRACK' | 'ACHIEVED';
export type GoalHealthLabel = 'HEALTHY' | 'AT_RISK' | 'OFF_TRACK';

export interface GoalPlan { amountRemaining: number; daysRemaining: number; monthsRemaining: number; progressPercentage: number; requiredContribution: number; status: GoalPlanStatus; expectedAmountByNow: number; isOnTrack: boolean; periodsRemaining: number; totalPeriods: number; elapsedPeriods: number; }
export interface GoalHealthResult { score: number; label: GoalHealthLabel; status: GoalPlanStatus; }
type DecimalInput = number | string | { toString(): string } | null | undefined;
interface GoalPlanInput { targetAmount: DecimalInput; currentAmount: DecimalInput; deadline: Date | string | null | undefined; contributionFrequency: ContributionFrequency | string | null | undefined; preferredContribution?: DecimalInput; createdAt?: Date | string | null | undefined; }

export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  try { const decimal = new Prisma.Decimal(value.toString()); return decimal.isFinite() ? decimal : new Prisma.Decimal(0); } catch { return new Prisma.Decimal(0); }
}
export function toNumber(value: unknown): number { return value == null ? 0 : toDecimal(value as DecimalInput).toNumber(); }
function normalizeDate(value: Date | string | null | undefined): Date { return value instanceof Date ? value : value ? new Date(value) : new Date(); }
export function normalizeFrequency(frequency: ContributionFrequency | string | null | undefined): ContributionFrequency {
  const value = String(frequency ?? 'MONTHLY').toUpperCase();
  return value === 'DAILY' || value === 'WEEKLY' || value === 'MONTHLY' ? value : 'MONTHLY';
}
function roundCurrency(value: Prisma.Decimal): number { return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(); }
function calculateDayDifference(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.ceil((endUtc - startUtc) / 86_400_000);
}
function calculatePeriodsBetween(start: Date, end: Date, frequency: ContributionFrequency): number {
  const days = calculateDayDifference(start, end);
  if (days <= 0) return 0;
  switch (frequency) { case 'DAILY': return days; case 'WEEKLY': return Math.max(1, Math.ceil(days / 7)); case 'MONTHLY': return Math.max(1, Math.ceil(days / 30)); }
}
export function calculatePeriodsUntilDeadline(deadline: Date, frequency: ContributionFrequency): number {
  const now = new Date();
  return calculateDayDifference(now, deadline) <= 0 ? 1 : calculatePeriodsBetween(now, deadline, frequency);
}
export function calculateRequiredContribution(targetAmount: DecimalInput, currentAmount: DecimalInput, deadline: Date, frequency: ContributionFrequency | string): number {
  const remaining = Prisma.Decimal.max(new Prisma.Decimal(0), toDecimal(targetAmount).minus(toDecimal(currentAmount)));
  if (remaining.isZero()) return 0;
  return roundCurrency(remaining.dividedBy(calculatePeriodsUntilDeadline(deadline, normalizeFrequency(frequency))));
}
export function assessFeasibility(requiredContribution: number, preferredContribution?: number): { feasible: boolean; shortfallPerPeriod: number } {
  if (preferredContribution === undefined) return { feasible: true, shortfallPerPeriod: 0 };
  const shortfall = requiredContribution - preferredContribution;
  return { feasible: shortfall <= 0, shortfallPerPeriod: shortfall > 0 ? Math.round(shortfall * 100) / 100 : 0 };
}
export function buildGoalPlan(input: GoalPlanInput): GoalPlan {
  const targetAmount = toDecimal(input.targetAmount); const currentAmount = toDecimal(input.currentAmount); const deadline = normalizeDate(input.deadline); const frequency = normalizeFrequency(input.contributionFrequency); const createdAt = normalizeDate(input.createdAt); const now = new Date();
  const amountRemaining = Prisma.Decimal.max(new Prisma.Decimal(0), targetAmount.minus(currentAmount));
  const daysRemaining = Math.max(0, calculateDayDifference(now, deadline)); const isAchieved = amountRemaining.isZero(); const isOverdue = !isAchieved && daysRemaining === 0;
  const periodsRemaining = calculatePeriodsUntilDeadline(deadline, frequency); const totalPeriods = calculatePeriodsBetween(createdAt, deadline, frequency); const elapsedPeriods = calculatePeriodsBetween(createdAt, now, frequency); const cappedElapsed = totalPeriods > 0 ? Math.min(elapsedPeriods, totalPeriods) : 0;
  const expectedAmountByNow = totalPeriods > 0 ? targetAmount.dividedBy(totalPeriods).mul(cappedElapsed) : new Prisma.Decimal(0);
  const progressPercentage = targetAmount.gt(0) ? Math.min(100, currentAmount.dividedBy(targetAmount).mul(100).toDecimalPlaces(0).toNumber()) : 0;
  const isOnTrack = isAchieved || (!isOverdue && currentAmount.greaterThanOrEqualTo(expectedAmountByNow));
  let status: GoalPlanStatus;
  if (isAchieved) status = 'ACHIEVED'; else if (isOverdue) status = 'OFF_TRACK'; else if (!isOnTrack) { const deficitRatio = expectedAmountByNow.gt(0) ? expectedAmountByNow.minus(currentAmount).dividedBy(expectedAmountByNow).toNumber() : 0; status = deficitRatio > 0.25 ? 'OFF_TRACK' : 'AT_RISK'; } else status = 'ACTIVE';
  return { amountRemaining: roundCurrency(amountRemaining), daysRemaining, monthsRemaining: Math.ceil(daysRemaining / 30), progressPercentage, requiredContribution: isAchieved ? 0 : calculateRequiredContribution(targetAmount, currentAmount, deadline, frequency), status, expectedAmountByNow: roundCurrency(expectedAmountByNow), isOnTrack, periodsRemaining, totalPeriods, elapsedPeriods };
}
export function calculateGoalHealthScore(plan: GoalPlan, targetAmount: DecimalInput): GoalHealthResult {
  if (plan.status === 'ACHIEVED') return { score: 100, label: 'HEALTHY', status: 'ACHIEVED' };
  if (plan.status === 'OFF_TRACK' && plan.daysRemaining === 0) return { score: 0, label: 'OFF_TRACK', status: 'OFF_TRACK' };
  const target = toDecimal(targetAmount); const saved = target.minus(plan.amountRemaining); const timeElapsedRatio = plan.totalPeriods > 0 ? Math.min(1, plan.elapsedPeriods / plan.totalPeriods) : 0; const progressRatio = target.gt(0) ? Math.min(1, saved.dividedBy(target).toNumber()) : 0;
  const progressScore = timeElapsedRatio === 0 ? 40 : Math.min(40, Math.round((progressRatio / timeElapsedRatio) * 40)); const remainingRatio = plan.totalPeriods > 0 ? plan.periodsRemaining / plan.totalPeriods : 0; const cushionScore = Math.round(Math.min(1, remainingRatio / 0.6) * 30); const deficitScore = plan.expectedAmountByNow <= 0 ? 30 : Math.round(Math.min(1, saved.toNumber() / plan.expectedAmountByNow) * 30); const score = Math.max(0, Math.min(100, progressScore + cushionScore + deficitScore));
  if (score >= 70) return { score, label: 'HEALTHY', status: 'ACTIVE' }; if (score >= 40) return { score, label: 'AT_RISK', status: 'AT_RISK' }; return { score, label: 'OFF_TRACK', status: 'OFF_TRACK' };
}
export function serializeGoalDecimal(goal: Record<string, unknown>): Record<string, unknown> {
  return { ...goal, targetAmount: toNumber(goal.targetAmount), currentAmount: toNumber(goal.currentAmount), preferredContribution: goal.preferredContribution == null ? null : toNumber(goal.preferredContribution), requiredContribution: goal.requiredContribution == null ? null : toNumber(goal.requiredContribution), goalHealthScore: goal.goalHealthScore == null ? null : toNumber(goal.goalHealthScore), deadline: goal.deadline ? new Date(goal.deadline as string) : null, createdAt: goal.createdAt ? new Date(goal.createdAt as string) : null };
}
export function buildGoalResponse(goal: Record<string, unknown>) {
  const serialized = serializeGoalDecimal(goal); const plan = buildGoalPlan({ targetAmount: serialized.targetAmount as number, currentAmount: serialized.currentAmount as number, deadline: serialized.deadline as Date | null, contributionFrequency: serialized.contributionFrequency as string, createdAt: serialized.createdAt as Date | null }); const health = calculateGoalHealthScore(plan, serialized.targetAmount as number); const feasibility = assessFeasibility(plan.requiredContribution, (serialized.preferredContribution as number | null) ?? undefined);
  return { ...serialized, progressPercentage: plan.progressPercentage, goalHealthScore: serialized.goalHealthScore ?? health.score, healthLabel: health.label, plan, feasibility };
}
