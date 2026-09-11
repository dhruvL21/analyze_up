import { describe, it, expect } from 'vitest';
import {
  evaluateDataReadiness,
  DataReadiness,
  IntelligenceLevel,
} from './data-readiness-engine';
import { analyzeDeadStockRisk } from './dead-stock-risk-engine';
import { computeInventoryQuality, computeBusinessHealth } from './command-center-engine';
import { computeProductIntelligence } from './product-intelligence-engine';
import { calculateDynamicBrief } from '@/ai/flows/ai-brief-generator';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { Product, Transaction } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function generateTransactions(
  orderCount: number,
  daySpan: number,
  options: {
    productId?: string;
    productName?: string;
    sku?: string;
    missingQuantity?: boolean;
    missingDate?: boolean;
  } = {}
): Transaction[] {
  const transactions: Transaction[] = [];
  const now = Date.now();

  for (let i = 0; i < orderCount; i++) {
    const fraction = orderCount > 1 ? i / (orderCount - 1) : 0;
    const ageDays = (1 - fraction) * daySpan;
    const dateTs = now - ageDays * MS_PER_DAY;

    transactions.push({
      id: `tx-${i + 1}`,
      type: 'Sale',
      productId: options.productId || `prod-${(i % 5) + 1}`,
      productName: options.productName || `Product ${(i % 5) + 1}`,
      sku: options.sku || `SKU-${(i % 5) + 1}`,
      quantity: options.missingQuantity ? undefined : 1 + (i % 3),
      totalAmount: 999 * (1 + (i % 3)),
      transactionDate: options.missingDate ? undefined : new Date(dateTs).toISOString(),
      createdAt: options.missingDate ? undefined : new Date(dateTs).toISOString(),
    } as any);
  }

  return transactions;
}

function generateProducts(
  count: number,
  options: {
    hasStock?: boolean;
    hasCostPrice?: boolean;
    stockValue?: number;
  } = {}
): Product[] {
  const products: Product[] = [];
  const hasStock = options.hasStock !== false;
  const hasCost = options.hasCostPrice !== false;

  for (let i = 1; i <= count; i++) {
    products.push({
      id: `prod-${i}`,
      name: `Product ${i}`,
      sku: `SKU-${i}`,
      price: 1000 + i * 100,
      costPrice: hasCost ? 500 + i * 50 : undefined,
      stock: hasStock ? (options.stockValue !== undefined ? options.stockValue : 20 + i * 5) : 0,
      category: 'Footwear',
      createdAt: new Date(Date.now() - 60 * MS_PER_DAY).toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  }

  return products;
}

describe('AnalyzeUp — Adaptive Intelligence & Data Maturity Engine', () => {
  // Scenario 1: New store (5 days, 20 orders) -> Level 1 (LEARNING)
  it('Scenario 1: New store (5 days, 20 orders) correctly assigns Level 1 (LEARNING)', () => {
    const products = generateProducts(10);
    const transactions = generateTransactions(20, 5);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.level).toBe<IntelligenceLevel>('LEARNING');
    expect(readiness.score).toBeLessThan(45);
    expect(readiness.capabilities.baselineSalesAnalytics).toBe(true);
    expect(readiness.capabilities.deadStockDetection).toBe(false);
    expect(readiness.capabilities.demandForecasting).toBe(false);
    expect(readiness.limitations.length).toBeGreaterThan(0);
    expect(readiness.limitations.some(l => l.includes('30 days') || l.includes('observing'))).toBe(true);
  });

  // Scenario 2: Early store (18 days, 300 orders) -> Level 2 (EARLY_INSIGHTS)
  it('Scenario 2: Early store (18 days, 300 orders) unlocks Level 2 (EARLY_INSIGHTS)', () => {
    const products = generateProducts(10);
    const transactions = generateTransactions(300, 18);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.level).toBe<IntelligenceLevel>('EARLY_INSIGHTS');
    expect(readiness.score).toBeGreaterThanOrEqual(45);
    expect(readiness.capabilities.deadStockDetection).toBe(true);
    expect(readiness.capabilities.marginAnalysis).toBe(true);
    // 30-day forecasting requires predictive depth
    expect(readiness.capabilities.seasonalityDetection).toBe(false);
  });

  // Scenario 3: Predictive store (45 days, 1,500 orders) -> Level 3 (PREDICTIVE)
  it('Scenario 3: Predictive store (45 days, 1,500 orders) unlocks Level 3 (PREDICTIVE)', () => {
    const products = generateProducts(20);
    const transactions = generateTransactions(1500, 45);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.level).toBe<IntelligenceLevel>('PREDICTIVE');
    expect(readiness.score).toBeGreaterThanOrEqual(65);
    expect(readiness.capabilities.demandForecasting).toBe(true);
    expect(readiness.capabilities.clearancePricing).toBe(true);
    expect(readiness.capabilities.safetyStockCalculation).toBe(true);
  });

  // Scenario 4: Mature store (180 days, 10,000+ orders) -> Level 4 (OPTIMIZATION)
  it('Scenario 4: Mature store (180 days, 10,000+ orders) achieves Level 4 (OPTIMIZATION)', () => {
    const products = generateProducts(50);
    const transactions = generateTransactions(10000, 180);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.level).toBe<IntelligenceLevel>('OPTIMIZATION');
    expect(readiness.score).toBeGreaterThanOrEqual(85);
    expect(readiness.capabilities.seasonalityDetection).toBe(true);
    expect(readiness.capabilities.advancedCohortLTV).toBe(true);
    expect(readiness.capabilities.dynamicSafetyStock).toBe(true);
  });

  // Scenario 5: Old but low-volume store (365 days, 20 orders) -> Low readiness score
  it('Scenario 5: Old store with sparse sales (365 days, 20 orders) does NOT falsely unlock predictive levels', () => {
    const products = generateProducts(10);
    const transactions = generateTransactions(20, 365);

    const readiness = evaluateDataReadiness(products, transactions);

    // Despite 365 calendar days, volume is too low for reliable statistical forecasting
    expect(readiness.level).toBe<IntelligenceLevel>('LEARNING');
    expect(readiness.score).toBeLessThan(50);
    expect(readiness.capabilities.demandForecasting).toBe(false);
  });

  // Scenario 6: High-volume new store (20 days, 5,000 orders) -> High density accelerates unlock
  it('Scenario 6: High-velocity new store (20 days, 5,000 orders) accelerates readiness score', () => {
    const products = generateProducts(30);
    const transactions = generateTransactions(5000, 20);

    const readiness = evaluateDataReadiness(products, transactions);

    // High order density provides strong statistical signal
    expect(readiness.score).toBeGreaterThanOrEqual(55);
    expect(readiness.level).not.toBe<IntelligenceLevel>('LEARNING');
    expect(readiness.capabilities.deadStockDetection).toBe(true);
  });

  // Scenario 7: Missing inventory -> Sales analytics work, inventory predictions limited
  it('Scenario 7: Missing stock levels limits inventory-specific capabilities with explicit warning', () => {
    const products = generateProducts(15, { hasStock: false });
    const transactions = generateTransactions(1000, 60);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.hasInventoryData).toBe(false);
    expect(readiness.capabilities.baselineSalesAnalytics).toBe(true);
    expect(readiness.capabilities.safetyStockCalculation).toBe(false);
    expect(readiness.limitations.some(l => l.toLowerCase().includes('inventory') || l.toLowerCase().includes('stock'))).toBe(true);
  });

  // Scenario 8: Missing margin/cost price -> Margin analysis disabled, clearance framed as sell-through acceleration
  it('Scenario 8: Missing cost price disables margin optimization and flags margin transparency', () => {
    const products = generateProducts(15, { hasCostPrice: false });
    const transactions = generateTransactions(1000, 60);

    const readiness = evaluateDataReadiness(products, transactions);

    expect(readiness.hasCostData).toBe(false);
    expect(readiness.capabilities.marginAnalysis).toBe(false);
    expect(readiness.limitations.some(l => l.toLowerCase().includes('cost') || l.toLowerCase().includes('margin'))).toBe(true);
  });

  // Scenario 9: Temporary sync failure / resilience high-water mark
  it('Scenario 9: Temporary sync failure preserves previous high-water mark within grace period', () => {
    const products = generateProducts(25);
    const transactions = generateTransactions(2000, 60);

    // First evaluate mature state
    const firstEval = evaluateDataReadiness(products, transactions);
    expect(firstEval.level).toBe<IntelligenceLevel>('PREDICTIVE');
    expect(firstEval.score).toBeGreaterThanOrEqual(65);

    // Temporary glitch: API sync returns empty transactions
    const degradedEval = evaluateDataReadiness(products, [], {
      previousSnapshot: firstEval,
    });

    // Resilience mechanism prevents abrupt downgrade to LEARNING
    expect(degradedEval.level).toBe<IntelligenceLevel>('PREDICTIVE');
    expect(degradedEval.score).toBe(firstEval.score);
    expect(degradedEval.reasons.some(r => r.includes('Preserved'))).toBe(true);
  });

  // Multi-Factor Dead Stock Risk Engine Tests
  describe('Dead Stock Risk Engine', () => {
    it('analyzes multi-factor dead stock risk and calculates stock coverage days', () => {
      const products: Product[] = [
        {
          id: 'prod-dead',
          name: 'Stagnant Winter Jacket',
          sku: 'STAG-JKT-1',
          stock: 50,
          price: 3000,
          costPrice: 1500,
          category: 'Jackets',
          createdAt: new Date(Date.now() - 90 * MS_PER_DAY).toISOString(),
        } as any,
        {
          id: 'prod-active',
          name: 'Best Selling Tee',
          sku: 'BST-TEE-1',
          stock: 20,
          price: 799,
          costPrice: 350,
          category: 'T-Shirts',
          createdAt: new Date(Date.now() - 90 * MS_PER_DAY).toISOString(),
        } as any,
      ];

      // Only give sales to the active product
      const activeTransactions: Transaction[] = [];
      for (let i = 0; i < 30; i++) {
        activeTransactions.push({
          id: `tx-active-${i}`,
          type: 'Sale',
          productId: 'prod-active',
          productName: 'Best Selling Tee',
          sku: 'BST-TEE-1',
          quantity: 2,
          totalAmount: 1598,
          transactionDate: new Date(Date.now() - i * MS_PER_DAY).toISOString(),
        } as any);
      }

      const report = analyzeDeadStockRisk(products, activeTransactions);

      expect(report.items.length).toBe(2);
      const deadItem = report.items.find(i => i.productId === 'prod-dead');
      const activeItem = report.items.find(i => i.productId === 'prod-active');

      expect(deadItem).toBeDefined();
      expect(deadItem?.riskLevel).toBe('CRITICAL');
      expect(deadItem?.stockCoverageDays).toBeGreaterThanOrEqual(365);
      expect(deadItem?.whyExplanation).toContain('No sales recorded');
      expect(deadItem?.recommendedDiscountPercent).toBe(25);

      expect(activeItem).toBeDefined();
      expect(activeItem?.riskLevel).toBe('LOW');
      expect(activeItem?.stockCoverageDays).toBeLessThan(30);
    });
  });

  describe('Beginner Dataset Data Readiness Guards (<30 Days History)', () => {
    const beginnerProducts: Product[] = [
      { id: 'p1', name: 'Sneaker High', sku: 'SNK-1', price: 2000, costPrice: 1200, stock: 25, averageDailySales: 1.8 } as any,
      { id: 'p2', name: 'Sneaker Low', sku: 'SNK-2', price: 1500, costPrice: 900, stock: 40, averageDailySales: 2.1 } as any,
      { id: 'p3', name: 'Zero Stock Tee', sku: 'TEE-0', price: 500, costPrice: 250, stock: 0 } as any,
    ];

    // 4-day sales history with 10 orders on only 1 product
    const beginnerTransactions: Transaction[] = generateTransactions(10, 4, {
      productId: 'p1',
      productName: 'Sneaker High',
      sku: 'SNK-1',
    });

    it('Scenario 10: computeInventoryQuality shows 0 dead stock when isDeadStockEnabled is false', () => {
      const qualityGuarded = computeInventoryQuality(beginnerProducts, beginnerTransactions, {
        isDeadStockEnabled: false,
        isVelocityEnabled: false,
      });

      expect(qualityGuarded.deadStockCount).toBe(0);
      expect(qualityGuarded.criticalStockCount).toBe(1); // p3 with stock: 0
      expect(qualityGuarded.healthyCount).toBe(2); // p1 and p2 are healthy
      expect(qualityGuarded.fastMovingCount).toBe(0); // suppressed in learning phase
    });

    it('Scenario 11: computeProductIntelligence marks zero-sale product as Healthy, NOT Dead Stock, and avoids contradictory badges', () => {
      // p2 has 0 sales in transactions, but has averageDailySales: 2.1 on product object
      const report = computeProductIntelligence(beginnerProducts[1], beginnerTransactions, [], [], {
        isDeadStockEnabled: false,
        isVelocityEnabled: false,
        historicalDays: 4,
      });

      expect(report.healthStatus).toBe('Healthy');
      expect(report.tags).not.toContain('Dead Stock');
      expect(report.tags).not.toContain('Best Seller');
      expect(report.tags).not.toContain('Trending');
      expect(report.averageDailySales).toBe(0); // confirmed 0 sales
    });

    it('Scenario 12: calculateDynamicBrief avoids 20% discount recommendations for beginner dataset', () => {
      const readiness = evaluateDataReadiness(beginnerProducts, beginnerTransactions);
      expect(readiness.level).toBe('LEARNING');

      const brief = calculateDynamicBrief(beginnerProducts, beginnerTransactions, {
        capabilities: readiness.capabilities,
        dataReadiness: readiness,
      });

      expect(brief.slowMovingItem.actionText).toContain('Monitor Velocity');
      expect(brief.slowMovingItem.actionText).not.toContain('20% Discount');
      expect(brief.slowMovingItem.riskText).toContain('Catalog In Holding Cycle');
    });

    it('Scenario 13: analyzeDeadStockRisk returns 0 dead stock for stores with < 30 days history', () => {
      const report = analyzeDeadStockRisk(beginnerProducts, beginnerTransactions, {
        isDeadStockEnabled: false,
        historicalDays: 4,
      });

      expect(report.totalDeadCapital).toBe(0);
      expect(report.items.length).toBe(0);
      expect(report.criticalRiskCount).toBe(0);
    });

    it('Scenario 14: generateBusinessForecastingReport suppresses 30D forecast and returns 0 projected revenue in learning stage', () => {
      const readiness = evaluateDataReadiness(beginnerProducts, beginnerTransactions);
      expect(readiness.level).toBe('LEARNING');

      const report = generateBusinessForecastingReport(beginnerProducts, beginnerTransactions, [], [], {
        capabilities: readiness.capabilities,
        dataReadiness: readiness,
      });

      expect(report.overallConfidence).toBe('INSUFFICIENT');
      expect(report.totalProjected30DayRevenue).toBe(0);
      expect(report.totalProjected30DayProfit).toBe(0);
      expect(report.criticalStockoutCount).toBe(0);
      expect(report.demandForecasts.every(df => df.forecast30Days === 0)).toBe(true);
      expect(report.confidenceReason).toContain('Baseline sales learning active');
    });

    it('Scenario 15: computeBusinessHealth does not report dead stock clearance for stores in learning stage', () => {
      const health = computeBusinessHealth(beginnerProducts, beginnerTransactions);
      expect(health.summarySentence).toContain('Baseline learning active');
      expect(health.summarySentence).not.toContain('dead stock items require clearance');
      expect(health.factors.deadStockRatio).toBe(100);
      expect(health.score).toBeGreaterThanOrEqual(70);
    });
  });
});
