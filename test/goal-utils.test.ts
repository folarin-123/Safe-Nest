import assert from 'node:assert/strict';
import { buildGoalPlan, calculateRequiredContribution } from '../src/modules/goals/goals.utils';

const now = new Date();
const futureDeadline = new Date(now);
futureDeadline.setDate(now.getDate() + 14);

const overdueDeadline = new Date(now);
overdueDeadline.setDate(now.getDate() - 3);

const activePlan = buildGoalPlan({
  targetAmount: 1000,
  currentAmount: 200,
  deadline: futureDeadline,
  contributionFrequency: 'weekly',
  preferredContribution: 50,
});

assert.equal(activePlan.amountRemaining, 800);
assert.equal(activePlan.progressPercentage, 20);
assert.equal(activePlan.requiredContribution, 400);
assert.equal(activePlan.status, 'ACTIVE');

const overduePlan = buildGoalPlan({
  targetAmount: 1000,
  currentAmount: 200,
  deadline: overdueDeadline,
  contributionFrequency: 'weekly',
  preferredContribution: 50,
});

assert.equal(overduePlan.status, 'OVERDUE');
assert.equal(overduePlan.isOnTrack, false);
assert.equal(overduePlan.amountRemaining, 800);

const catchUp = calculateRequiredContribution(1000, 200, overdueDeadline, 'weekly');
assert.equal(catchUp, 800);

console.log('Goal plan tests passed');
