export class GoalProgressResponseDto {
  id!: string;

  goalName!: string;

  targetAmount!: number;

  currentAmount!: number;

  deadline!: Date;

  contributionFrequency!: string;

  requiredContribution!: number | null; // Value can be null, but key must exist

  amountRemaining!: number;

  daysRemaining!: number;

  monthsRemaining!: number;

  progressPercentage!: number; // 0-100

  status!: string;

  expectedAmountByNow!: number; // for internal use

  isOnTrack!: boolean;
}