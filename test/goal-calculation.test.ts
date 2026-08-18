

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GoalCalculationService } from '../src/modules/goals/goal-calculation.service';

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function makeGoal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'goal-1',
    userId: 'user-1',
    goalName: 'Emergency Fund',
    category: 'EMERGENCY',
    targetAmount: { toString: () => '100000' },
    currentAmount: { toString: () => '20000' },
    deadline: daysFromNow(90),
    contributionFrequency: 'MONTHLY',
    preferredContribution: null,
    requiredContribution: null,
    goalHealthScore: null,
    priority: 0,
    status: 'ACTIVE',
    description: null,
    createdAt: daysFromNow(-30),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma(goalOverrides: Partial<Record<string, unknown>> = {}) {
  const mockGoal = makeGoal(goalOverrides);
  return {
    goal: {
      findFirst: async () => mockGoal,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...mockGoal, ...data }),
      updateMany: async () => ({ count: 1 }),
    },
  } as unknown as any;
}

// ── calculateGoalProgress ────────────────────────────────────────────────────

describe('GoalCalculationService.calculateGoalProgress', () => {
  it('returns required breakdown fields', async () => {
    const svc = new GoalCalculationService(makePrisma());
    const r = await svc.calculateGoalProgress('goal-1', 'user-1');
    assert.equal(r.goalId, 'goal-1');
    assert.equal(r.progressPercentage, 20);
    assert.equal(r.amountRemaining, 80000);
    assert.ok('daysRemaining' in r);
    assert.ok('requiredContribution' in r);
    assert.ok('isOnTrack' in r);
  });
});

// ── calculateGoalHealthScore ─────────────────────────────────────────────────

describe('GoalCalculationService.calculateGoalHealthScore', () => {
  it('returns score 0–100 with valid label and status', async () => {
    const svc = new GoalCalculationService(makePrisma());
    const r = await svc.calculateGoalHealthScore('goal-1', 'user-1');
    assert.equal(r.goalId, 'goal-1');
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(['HEALTHY', 'AT_RISK', 'OFF_TRACK'].includes(r.label));
  });

  it('returns 100/ACHIEVED for a fully funded goal', async () => {
    const svc = new GoalCalculationService(
      makePrisma({ currentAmount: { toString: () => '100000' } }),
    );
    const r = await svc.calculateGoalHealthScore('goal-1', 'user-1');
    assert.equal(r.score, 100);
    assert.equal(r.status, 'ACHIEVED');
  });
});

// ── generateSmartRecoveryPlan ────────────────────────────────────────────────

describe('GoalCalculationService.generateSmartRecoveryPlan', () => {
  it('returns a valid recovery plan with a catch-up note', async () => {
    const svc = new GoalCalculationService(makePrisma());
    const r = await svc.generateSmartRecoveryPlan('goal-1', 'user-1', 5000);
    assert.equal(r.goalId, 'goal-1');
    assert.equal(r.missedAmount, 5000);
    assert.ok(r.newRequiredContribution > 0);
    assert.ok(r.catchUpNote.includes('Missed'));
    assert.ok('updatedHealth' in r && 'plan' in r);
  });

  it('recovery requires a higher contribution than normal', async () => {
    const svc1 = new GoalCalculationService(makePrisma());
    const svc2 = new GoalCalculationService(makePrisma());
    const [progress, recovery] = await Promise.all([
      svc1.calculateGoalProgress('goal-1', 'user-1'),
      svc2.generateSmartRecoveryPlan('goal-1', 'user-1', 10000),
    ]);
    assert.ok(recovery.newRequiredContribution >= progress.requiredContribution);
  });
});

// ── simulateGoalScenario ─────────────────────────────────────────────────────

describe('GoalCalculationService.simulateGoalScenario', () => {
  const svc = new GoalCalculationService(null as any); // stateless

  it('returns a valid scenario for future deadline', () => {
    const deadline = daysFromNow(60).toISOString().split('T')[0];
    const r = svc.simulateGoalScenario(50000, deadline, 'MONTHLY', 0);
    assert.equal(r.targetAmount, 50000);
    assert.equal(r.frequency, 'MONTHLY');
    assert.ok(r.requiredContributionPerPeriod > 0);
    assert.ok(r.feasible);
  });

  it('marks past deadline as not feasible', () => {
    const deadline = daysFromNow(-10).toISOString().split('T')[0];
    const r = svc.simulateGoalScenario(50000, deadline, 'MONTHLY', 0);
    assert.equal(r.feasible, false);
  });

  it('partial progress reduces required contribution', () => {
    const deadline = daysFromNow(30).toISOString().split('T')[0];
    const full = svc.simulateGoalScenario(10000, deadline, 'MONTHLY', 0);
    const partial = svc.simulateGoalScenario(10000, deadline, 'MONTHLY', 5000);
    assert.ok(partial.requiredContributionPerPeriod < full.requiredContributionPerPeriod);
  });
});

console.log('✅ GoalCalculationService tests passed');
