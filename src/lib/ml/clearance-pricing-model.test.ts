import { describe, it, expect } from 'vitest';
import { predictOptimalClearanceDiscount } from './clearance-pricing-model';
import type { Transaction } from '../types';

describe('Sales-Driven Clearance Pricing Model Suite', () => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const now = Date.now();

  it('differentiates discounts between completely dead products and moderately slow products', () => {
    // Product A: 0 sales ever, sitting 90 days with 85 units
    const deadProduct = {
      id: 'prod-dead-1',
      name: 'Handcrafted Italian Leather Loafers - White (L)',
      sku: 'ANUP-1066',
      price: 7999,
      costPrice: 3200,
      stock: 85,
      category: 'Footwear',
    };

    // Product B: Had recent sales (15 days ago), 25 units
    const mildProduct = {
      id: 'prod-mild-2',
      name: 'Handcrafted Italian Leather Loafers - Beige (S)',
      sku: 'ANUP-1146',
      price: 7999,
      costPrice: 3200,
      stock: 25,
      category: 'Footwear',
    };

    const deadPrediction = predictOptimalClearanceDiscount(deadProduct, {
      salesMetrics: {
        totalUnitsSold: 0,
        salesLast30Days: 0,
        salesLast60Days: 0,
        daysSinceLastSale: null,
        stockCoverageDays: 365,
        productAgeDays: 90,
      },
    });

    const mildPrediction = predictOptimalClearanceDiscount(mildProduct, {
      salesMetrics: {
        totalUnitsSold: 8,
        salesLast30Days: 2,
        salesLast60Days: 5,
        daysSinceLastSale: 15,
        stockCoverageDays: 120,
        productAgeDays: 90,
      },
    });

    // Dead stock should receive a deeper clearance discount than mild product
    expect(deadPrediction.discountPercent).toBeGreaterThan(mildPrediction.discountPercent);
    expect(deadPrediction.discountPercent).toBeGreaterThanOrEqual(28);
    expect(mildPrediction.discountPercent).toBeLessThanOrEqual(20);

    // Ensure it NEVER collapses to the old flat 21% for both
    expect(deadPrediction.discountPercent).not.toBe(mildPrediction.discountPercent);
  });

  it('strictly protects margin headroom on low-margin products so they never sell below cost', () => {
    // Product with only 18% gross margin (Price: 1000, Cost: 820)
    const lowMarginProduct = {
      id: 'prod-low-margin',
      name: 'Thin Margin Tech Cable',
      sku: 'ANUP-CBL-1',
      price: 1000,
      costPrice: 820,
      stock: 100,
      category: 'Electronics',
    };

    const prediction = predictOptimalClearanceDiscount(lowMarginProduct, {
      salesMetrics: {
        totalUnitsSold: 0,
        salesLast30Days: 0,
        salesLast60Days: 0,
        daysSinceLastSale: null,
        stockCoverageDays: 365,
        productAgeDays: 120,
      },
    });

    // Discount must be capped by margin headroom to keep new price >= cost
    expect(prediction.newPrice).toBeGreaterThanOrEqual(lowMarginProduct.costPrice);
    expect(prediction.discountPercent).toBeLessThanOrEqual(15);
    expect(prediction.grossMarginAfter).toBeGreaterThanOrEqual(0);
  });

  it('derives accurate sales metrics dynamically from raw transactions when passed', () => {
    const product = {
      id: 'prod-shoes',
      sku: 'SHOE-001',
      name: 'Athletic Running Sneakers',
      price: 4999,
      costPrice: 2000,
      stock: 60,
      category: 'Footwear',
    };

    // Create transactions where last sale was 75 days ago
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        type: 'Sale',
        productId: 'prod-shoes',
        sku: 'SHOE-001',
        quantity: 1,
        transactionDate: new Date(now - 75 * MS_PER_DAY).toISOString(),
      } as any,
    ];

    const prediction = predictOptimalClearanceDiscount(product, {
      transactions,
    });

    expect(prediction.salesDataExplanation?.daysSinceLastSale).toBe(75);
    expect(prediction.salesDataExplanation?.unitsSoldLast30d).toBe(0);
    expect(prediction.aiRationale).toContain('75 days');
    expect(prediction.discountPercent).toBeGreaterThanOrEqual(24);
  });

  it('generates rich, transparent AI rationale referencing real sales data', () => {
    const product = {
      id: 'prod-test',
      name: 'ANC Wireless Headphones',
      price: 8999,
      costPrice: 3800,
      stock: 58,
      category: 'Smartphones & Audio',
    };

    const prediction = predictOptimalClearanceDiscount(product, {
      salesMetrics: {
        totalUnitsSold: 0,
        salesLast30Days: 0,
        salesLast60Days: 0,
        daysSinceLastSale: null,
        stockCoverageDays: 365,
        productAgeDays: 90,
      },
    });

    expect(prediction.aiRationale).toContain('Zero customer sales recorded');
    expect(prediction.aiRationale).toContain('58 units');
    expect(prediction.aiRationale).toContain('gross profit');
    expect(prediction.newPrice).toBe(Math.round(8999 * (1 - prediction.discountPercent / 100)));
  });
});
