import { describe, it, expect } from 'vitest';
import {
  getCurrentBillingMonth,
  isNewBillingMonth,
  createInitialMonthlyUsage,
  checkUsageLimit,
  PLAN_CONFIGS,
  canUseFeature,
} from './saas-engine';

describe('SaaS Engine - Account-Level Usage & Monthly Billing Cycle', () => {
  it('correctly formats the current billing month as YYYY-MM', () => {
    const current = getCurrentBillingMonth();
    expect(current).toMatch(/^\d{4}-\d{2}$/);
  });

  it('detects when a stored usage month differs from the current month', () => {
    const currentMonth = getCurrentBillingMonth();
    // Same month should NOT reset
    expect(isNewBillingMonth(currentMonth)).toBe(false);

    // Prior month (e.g. 2026-08 when current is 2026-09) MUST trigger monthly reset
    expect(isNewBillingMonth('2026-08')).toBe(true);
    expect(isNewBillingMonth('2025-12')).toBe(true);
  });

  it('initializes fresh monthly usage with zeroed quotas and current month timestamp', () => {
    const usage = createInitialMonthlyUsage();
    expect(usage.billingMonth).toBe(getCurrentBillingMonth());
    expect(usage.aiQueriesCount).toBe(0);
    expect(usage.reportsCount).toBe(0);
    expect(usage.lastResetDate).toBeDefined();
  });

  it('verifies Enterprise Pro plan limits match expected workspace quotas', () => {
    const pro = PLAN_CONFIGS.PRO;
    expect(pro.productLimit).toBe(250000);
    expect(pro.aiQueriesLimit).toBe(10000);
    expect(pro.reportsLimit).toBe(5000);
    expect(pro.teamMembersLimit).toBe(50);

    // Check usage meter checks on PRO
    const productCheck = checkUsageLimit('PRO', 'products', 85);
    expect(productCheck.limit).toBe(250000);
    expect(productCheck.usagePercent).toBe(0);
    expect(productCheck.allowed).toBe(true);

    const aiCheck = checkUsageLimit('PRO', 'aiQueries', 0);
    expect(aiCheck.limit).toBe(10000);
    expect(aiCheck.usagePercent).toBe(0);
    expect(aiCheck.allowed).toBe(true);

    const reportCheck = checkUsageLimit('PRO', 'reports', 1);
    expect(reportCheck.limit).toBe(5000);
    expect(reportCheck.usagePercent).toBe(0);
    expect(reportCheck.allowed).toBe(true);

    const teamCheck = checkUsageLimit('PRO', 'teamMembers', 1);
    expect(teamCheck.limit).toBe(50);
    expect(teamCheck.usagePercent).toBe(2);
    expect(teamCheck.allowed).toBe(true);
  });

  it('enforces limit warning at 80% and blocking at 100%', () => {
    // 80% warning
    const warning = checkUsageLimit('FREE', 'aiQueries', 40); // 40/50 = 80%
    expect(warning.isWarning80).toBe(true);
    expect(warning.isBlocked100).toBe(false);
    expect(warning.allowed).toBe(true);

    // 100% blocked
    const blocked = checkUsageLimit('FREE', 'aiQueries', 50); // 50/50 = 100%
    expect(blocked.isBlocked100).toBe(true);
    expect(blocked.allowed).toBe(false);
  });

  it('verifies entitlement features per tier', () => {
    expect(canUseFeature('FREE', 'AI_COPILOT')).toBe(true);
    expect(canUseFeature('FREE', 'ADVANCED_REPORTS')).toBe(false);
    expect(canUseFeature('PRO', 'ADVANCED_REPORTS')).toBe(true);
  });
});
