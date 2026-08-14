export class GoalProgressResponseDto {
  id!: string;
  goalName!: string;
  targetAmount!: number;
  currentAmount!: number;
  deadline!: Date;
  contributionFrequency!: string;
  requiredContribution!: number | null;
  amountRemaining!: number;
  daysRemaining!: number;
  monthsRemaining!: number;
  progressPercentage!: number;
  status!: string;
  expectedAmountByNow!: number;
  isOnTrack!: boolean;
  periodsRemaining!: number;
  totalPeriods!: number;
  elapsedPeriods!: number;
  feasibility?: {
    feasible: boolean;
    shortfallPerPeriod: number;
  };
  plan?: {
    amountRemaining: number;
    daysRemaining: number;
    monthsRemaining: number;
    progressPercentage: number;
    requiredContribution: number;
    status: string;
    expectedAmountByNow: number;
    isOnTrack: boolean;
    periodsRemaining: number;
    totalPeriods: number;
    elapsedPeriods: number;
  };
}