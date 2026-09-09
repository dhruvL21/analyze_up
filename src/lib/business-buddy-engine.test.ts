import { describe, it, expect } from 'vitest';
import {
  detectStoreIndustry,
  getIndustryHoldingPeriod,
  analyzeDailySalesPatterns,
  analyzeWhyNotSold,
  analyzeReturnPatterns,
  getDefaultMarketIntelligence,
  getBusinessBuddyCalibration,
} from './business-buddy-engine';
import { generateActionTasks } from './command-center-engine';
import { Product, Transaction, ProductReturn, BusinessProfile } from './types';

describe('AI Business Buddy & Daily Pattern Learning Engine', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'SNKHED Courtline 03 (10)',
      sku: 'SNK-CRT-03-10',
      price: 4999,
      costPrice: 2499,
      stock: 12,
      category: 'Sneakers',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'prod-2',
      name: 'SNKHED Courtline 03 (9)',
      sku: 'SNK-CRT-03-9',
      price: 4999,
      costPrice: 2499,
      stock: 8,
      category: 'Sneakers',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
    {
      id: 'prod-3',
      name: 'SNKHED Velocity 08 (11)',
      sku: 'SNK-VEL-08-11',
      price: 5999,
      costPrice: 2999,
      stock: 0,
      minStock: 5,
      leadTimeDays: 7,
      category: 'Sneakers',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    },
  ];

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      productId: 'prod-1',
      productName: 'SNKHED Courtline 03 (10)',
      sku: 'SNK-CRT-03-10',
      quantity: 2,
      price: 4999,
      totalRevenue: 9998,
      type: 'Sale',
      transactionDate: '2026-09-08T14:30:00Z',
      createdAt: '2026-09-08T14:30:00Z',
      updatedAt: '2026-09-08T14:30:00Z',
    },
    {
      id: 'tx-2',
      productId: 'prod-1',
      productName: 'SNKHED Courtline 03 (10)',
      sku: 'SNK-CRT-03-10',
      quantity: 1,
      price: 4999,
      totalRevenue: 4999,
      type: 'Sale',
      transactionDate: '2026-09-07T11:00:00Z',
      createdAt: '2026-09-07T11:00:00Z',
      updatedAt: '2026-09-07T11:00:00Z',
    },
  ];

  const sampleReturns: ProductReturn[] = [
    {
      id: 'ret-1',
      productId: 'prod-1',
      productName: 'SNKHED Courtline 03 (10)',
      sku: 'SNK-CRT-03-10',
      quantity: 1,
      customerName: 'Rahul M.',
      refundAmount: 4999,
      reason: 'Other',
      refundStatus: 'Refunded',
      actionTaken: 'Restocked',
      returnDate: '2026-09-08T16:00:00Z',
      createdAt: '2026-09-08T16:00:00Z',
      updatedAt: '2026-09-08T16:00:00Z',
    },
  ];

  it('detects footwear & sneaker industry accurately from product titles and brand', () => {
    const result = detectStoreIndustry(sampleProducts, { businessName: 'SNKHED Footwear' } as BusinessProfile);
    expect(result.category).toBe('footwear_sneakers');
    expect(result.industry).toBe('Footwear & Sneaker Retail');
  });

  it('assigns 65-day holding period for footwear to protect margin vs 35 for apparel', () => {
    const footwearHolding = getIndustryHoldingPeriod('footwear_sneakers');
    expect(footwearHolding.days).toBe(65);
    expect(footwearHolding.explanation).toContain('60–75 day window');

    const apparelHolding = getIndustryHoldingPeriod('fashion_apparel');
    expect(apparelHolding.days).toBe(35);
  });

  it('analyzes daily sales velocity and peak patterns (how products are sold)', () => {
    const salesPattern = analyzeDailySalesPatterns(sampleTransactions);
    expect(salesPattern.totalOrdersObserved).toBe(2);
    expect(salesPattern.totalUnitsSold).toBe(3);
    expect(salesPattern.topVelocityProducts[0].name).toBe('SNKHED Courtline 03 (10)');
    expect(salesPattern.dailyVelocity).toBeGreaterThan(0);
  });

  it('analyzes unsold items and explains dormancy based on holding period (why products are NOT sold)', () => {
    const unsoldPattern = analyzeWhyNotSold(sampleProducts, sampleTransactions, 'footwear_sneakers');
    // prod-2 has stock 8 and 0 sales
    expect(unsoldPattern.unsoldProductsCount).toBe(1);
    expect(unsoldPattern.holdingThresholdDays).toBe(65);
    expect(unsoldPattern.sizingDistribution['9']).toBe(8);
    expect(unsoldPattern.primaryReason).toContain('within normal 65-day category lifecycle');
  });

  it('analyzes return reasons and computes net velocity adjustment (why products are returned)', () => {
    const returnPattern = analyzeReturnPatterns(sampleReturns, sampleTransactions, sampleProducts);
    expect(returnPattern.totalReturns).toBe(1);
    expect(returnPattern.overallReturnRate).toBeGreaterThan(0);
    expect(returnPattern.topReasons[0].reason).toBe('Other');
    expect(returnPattern.netVelocityAdjustment).toContain('Net velocity adjusted downward');
  });

  it('returns default market intelligence with warm buddy advice', () => {
    const intel = getDefaultMarketIntelligence('Footwear Retail', 'footwear_sneakers');
    expect(intel.holdingPeriodDays).toBe(65);
    expect(intel.recommendedDiscountRange.min).toBe(12);
    expect(intel.buddyAdvice).toContain('Hey Founder');
  });

  it('starts newly imported store in Day 1 LEARNING state for 3 days', () => {
    const freshProfile: Partial<BusinessProfile> = {
      firstImportedAt: new Date().toISOString(),
      buddyCalibrationTargetDays: 3,
    };
    const calibration = getBusinessBuddyCalibration(
      freshProfile,
      sampleProducts,
      sampleTransactions,
      sampleReturns
    );
    expect(calibration.status).toBe('LEARNING');
    expect(calibration.currentDayNumber).toBe(1);
    expect(calibration.isCalibrated).toBe(false);
  });

  it('transitions to CALIBRATED immediately when overridden by founder', () => {
    const overriddenProfile: Partial<BusinessProfile> = {
      firstImportedAt: new Date().toISOString(),
      buddyCalibrationOverridden: true,
      calibrationStatus: 'CALIBRATED',
    };
    const calibration = getBusinessBuddyCalibration(
      overriddenProfile,
      sampleProducts,
      sampleTransactions,
      sampleReturns
    );
    expect(calibration.status).toBe('CALIBRATED');
    expect(calibration.isCalibrated).toBe(true);
    expect(calibration.isOverridden).toBe(true);
  });

  it('transitions to CALIBRATED automatically when 3 days have elapsed', () => {
    // 4 days ago
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const maturedProfile: Partial<BusinessProfile> = {
      firstImportedAt: fourDaysAgo,
      buddyCalibrationTargetDays: 3,
    };
    const calibration = getBusinessBuddyCalibration(
      maturedProfile,
      sampleProducts,
      sampleTransactions,
      sampleReturns
    );
    expect(calibration.status).toBe('CALIBRATED');
    expect(calibration.daysElapsed).toBeGreaterThanOrEqual(3);
    expect(calibration.isCalibrated).toBe(true);
  });

  it('pauses automated action tasks during the 3-day learning calibration phase', () => {
    const freshProfile: Partial<BusinessProfile> = {
      firstImportedAt: new Date().toISOString(),
      buddyCalibrationTargetDays: 3,
    };
    const tasks = generateActionTasks(
      sampleProducts,
      sampleTransactions,
      [],
      [],
      freshProfile as BusinessProfile,
      sampleReturns
    );
    // Tasks should be empty during Day 1 learning phase
    expect(tasks).toEqual([]);
  });

  it('unlocks automated action tasks once calibrated or overridden', () => {
    const calibratedProfile: Partial<BusinessProfile> = {
      firstImportedAt: new Date().toISOString(),
      buddyCalibrationOverridden: true,
      calibrationStatus: 'CALIBRATED',
    };
    const tasks = generateActionTasks(
      sampleProducts,
      sampleTransactions,
      [],
      [],
      calibratedProfile as BusinessProfile,
      sampleReturns
    );
    // Restock task for prod-3 (stock: 0) and Dead stock liquidation for prod-2 should be generated
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some(t => t.actionType === 'reorder')).toBe(true);
  });
});
