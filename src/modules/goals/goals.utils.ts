export type ContributionFrequency = 'daily' | 'weekly' | 'monthly';

/**
 * Calculates how many contribution periods (days/weeks/months) remain
 * between now and the deadline.
 */
export function calculatePeriodsUntilDeadline(
  deadline: Date,
  frequency: ContributionFrequency,
): number {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.ceil(
    (deadline.getTime() - now.getTime()) / msPerDay,
  );

  if (totalDays <= 0) {
    throw new Error('Deadline must be in the future');
  }

  switch (frequency) {
    case 'daily':
      return totalDays;
    case 'weekly':
      return Math.max(1, Math.ceil(totalDays / 7));
    case 'monthly':
      return Math.max(1, Math.ceil(totalDays / 30));
  }
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
  const remaining = targetAmount - currentAmount;

  if (remaining <= 0) {
    return 0; // goal already met or exceeded
  }

  const periods = calculatePeriodsUntilDeadline(deadline, frequency);
  const required = remaining / periods;

  return Math.round(required * 100) / 100; // round to 2 decimal places
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
    shortfallPerPeriod: shortfall > 0 ? Math.round(shortfall * 100) / 100 : 0,
  };
}