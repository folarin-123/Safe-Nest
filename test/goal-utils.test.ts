/**
 * goal-utils.test.ts
 * Unit tests for the SafeNest goal calculation engine (PRD Step 4).
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGoalPlan,
  calculateRequiredContribution,
  calculateGoalHealthScore,
  assessFeasibility,
  normalizeFrequency,
} from '../src/modules/goals/goals.utils';

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRD Formula: Required Contribution = (Target - Current) / Remaining Periods
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateRequiredContribution', () => {
  it('calculates correctly for a monthly goal (30 days = 1 period)', () => {
    const result = calculateRequiredContribution(1000, 0, daysFromNow(30), 'MONTHLY');
    assert.equal(result, 1000);
  });

  it('returns 0 when goal is already achieved', () => {
    assert.equal(calculateRequiredContribution(1000, 1000, daysFromNow(30), 'MONTHLY'), 0);
  });

  it('clamps to full remaining when overdue (periods=1)', () => {
    assert.equal(calculateRequiredContribution(1000, 200, daysFromNow(-3), 'WEEKLY'), 800);
  });

  it('accepts lowercase frequency and normalises', () => {
    const a = calculateRequiredContribution(1000, 0, daysFromNow(30), 'monthly');
    const b = calculateRequiredContribution(1000, 0, daysFromNow(30), 'MONTHLY');
    assert.equal(a, b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRD Status Transitions: ACTIVE → AT_RISK → OFF_TRACK → ACHIEVED
// ─────────────────────────────────────────────────────────────────────────────

describe('buildGoalPlan — status transitions', () => {
  it('ACTIVE — on-track goal with time remaining', () => {
    const plan = buildGoalPlan({
      targetAmount: 1000,
      currentAmount: 200,
      deadline: daysFromNow(90),
      contributionFrequency: 'MONTHLY',
    });
    assert.equal(plan.status, 'ACTIVE');
    assert.equal(plan.progressPercentage, 20);
    assert.equal(plan.amountRemaining, 800);
  });

  it('ACHIEVED — goal fully funded', () => {
    const plan = buildGoalPlan({
      targetAmount: 1000,
      currentAmount: 1000,
      deadline: daysFromNow(30),
      contributionFrequency: 'MONTHLY',
    });
    assert.equal(plan.status, 'ACHIEVED');
    assert.equal(plan.amountRemaining, 0);
    assert.equal(plan.isOnTrack, true);
  });

  it('OFF_TRACK — overdue goal', () => {
    const plan = buildGoalPlan({
      targetAmount: 1000,
      currentAmount: 200,
      deadline: daysFromNow(-3),
      contributionFrequency: 'WEEKLY',
    });
    assert.equal(plan.status, 'OFF_TRACK');
    assert.equal(plan.isOnTrack, false);
  });

  it('weekly periods — 14 days = 2 periods, required = 400', () => {
    const plan = buildGoalPlan({
      targetAmount: 1000,
      currentAmount: 200,
      deadline: daysFromNow(14),
      contributionFrequency: 'WEEKLY',
    });
    assert.equal(plan.amountRemaining, 800);
    assert.equal(plan.periodsRemaining, 2);
    assert.equal(plan.requiredContribution, 400);
  });

  it('progress percentage caps at 100', () => {
    const plan = buildGoalPlan({
      targetAmount: 500,
      currentAmount: 600,
      deadline: daysFromNow(10),
      contributionFrequency: 'WEEKLY',
    });
    assert.equal(plan.progressPercentage, 100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRD Goal Health Score Engine
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateGoalHealthScore', () => {
  it('returns 100/HEALTHY/ACHIEVED for a fully funded goal', () => {
    const plan = buildGoalPlan({
      targetAmount: 1000,
      currentAmount: 1000,
      deadline: daysFromNow(10),
      contributionFrequency: 'MONTHLY',
    });
    const result = calculateGoalHealthScore(plan, 1000);
    assert.equal(result.score, 100);
    assert.equal(result.label, 'HEALTHY');
    assert.equal(result.status, 'ACHIEVED');
  });

  it('returns a 0–100 score for active goals', () => {
    const plan = buildGoalPlan({
      targetAmount: 10000,
      currentAmount: 500,
      deadline: daysFromNow(60),
      contributionFrequency: 'MONTHLY',
      createdAt: daysFromNow(-30),
    });
    const result = calculateGoalHealthScore(plan, 10000);
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it('significantly behind goal returns AT_RISK or OFF_TRACK', () => {
    const plan = buildGoalPlan({
      targetAmount: 10000,
      currentAmount: 100,
      deadline: daysFromNow(10),
      contributionFrequency: 'MONTHLY',
      createdAt: daysFromNow(-300),
    });
    const result = calculateGoalHealthScore(plan, 10000);
    assert.ok(
      result.label === 'AT_RISK' || result.label === 'OFF_TRACK',
      `Expected AT_RISK or OFF_TRACK, got ${result.label}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feasibility
// ─────────────────────────────────────────────────────────────────────────────

describe('assessFeasibility', () => {
  it('feasible when preferred >= required', () => {
    const r = assessFeasibility(300, 400);
    assert.equal(r.feasible, true);
    assert.equal(r.shortfallPerPeriod, 0);
  });

  it('not feasible when preferred < required', () => {
    const r = assessFeasibility(500, 300);
    assert.equal(r.feasible, false);
    assert.equal(r.shortfallPerPeriod, 200);
  });

  it('always feasible when preferred not provided', () => {
    const r = assessFeasibility(500);
    assert.equal(r.feasible, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Frequency normalisation
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeFrequency', () => {
  it('accepts uppercase DAILY/WEEKLY/MONTHLY', () => {
    assert.equal(normalizeFrequency('DAILY'), 'DAILY');
    assert.equal(normalizeFrequency('WEEKLY'), 'WEEKLY');
    assert.equal(normalizeFrequency('MONTHLY'), 'MONTHLY');
  });
  it('normalises lowercase to uppercase', () => {
    assert.equal(normalizeFrequency('daily'), 'DAILY');
    assert.equal(normalizeFrequency('monthly'), 'MONTHLY');
  });
  it('defaults to MONTHLY for unknown values', () => {
    assert.equal(normalizeFrequency(null), 'MONTHLY');
  });
});

console.log('✅ goal-utils tests passed');
