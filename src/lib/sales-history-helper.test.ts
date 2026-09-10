import { describe, it, expect } from 'vitest';
import { evaluateSalesHistory } from './sales-history-helper';
import type { Product, Transaction } from './types';

describe('evaluateSalesHistory', () => {
  const mockProductA: Product = {
    id: 'prod-1',
    name: 'SNKHED Apex 01',
    stock: 25,
    price: 5500,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  };

  const mockProductB: Product = {
    id: 'prod-2',
    name: 'SNKHED Courtline 09',
    stock: 0,
    minStock: 5,
    price: 4500,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  };

  it('rejects dead stock and price increase predictions when data has less than 30 days of sales history', () => {
    // Only 3 days of sales data (e.g. Sept 4 to Sept 7)
    const recentTransactions: Transaction[] = [
      {
        id: 'tx-1',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 1,
        transactionDate: '2026-09-04',
        createdAt: '2026-09-04',
      },
      {
        id: 'tx-2',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 2,
        transactionDate: '2026-09-07',
        createdAt: '2026-09-07',
      },
    ];

    const evalResult = evaluateSalesHistory([mockProductA, mockProductB], recentTransactions);

    expect(evalResult.hasMinimumHistory).toBe(false);
    expect(evalResult.historyDays).toBeLessThan(30);

    // Cannot declare dead stock or suggest clearance discount without 30 days of history
    expect(evalResult.isProductEligibleForDeadStock(mockProductA)).toBe(false);
    expect(evalResult.isProductEligibleForDeadStock(mockProductB)).toBe(false);

    // Cannot declare high velocity margin optimization without 30 days of history
    expect(evalResult.isProductEligibleForPriceUp(mockProductA)).toBe(false);
  });

  it('accepts predictions instantly when product data has at least 30 days of sales history', () => {
    const thirtyDaysAgo = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const historicalTransactions: Transaction[] = [
      {
        id: 'tx-old',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 15,
        transactionDate: thirtyDaysAgo,
        createdAt: thirtyDaysAgo,
      },
      {
        id: 'tx-recent',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 20,
        transactionDate: yesterday,
        createdAt: yesterday,
      },
    ];

    const oldProductWithNoSales: Product = {
      id: 'prod-dead-1',
      name: 'Old Unsold Shoes',
      stock: 40,
      price: 2000,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    };

    const evalResult = evaluateSalesHistory([mockProductA, oldProductWithNoSales], historicalTransactions);

    expect(evalResult.hasMinimumHistory).toBe(true);
    expect(evalResult.historyDays).toBeGreaterThanOrEqual(30);

    // High velocity product with sustained sales in 30 days is eligible for price optimization
    expect(evalResult.isProductEligibleForPriceUp(mockProductA)).toBe(true);
    expect(evalResult.isProductEligibleForDeadStock(mockProductA)).toBe(false);

    // Old product with 0 sales across 30+ days is eligible for clearance dead stock
    expect(evalResult.isProductEligibleForDeadStock(oldProductWithNoSales)).toBe(true);
    expect(evalResult.isProductEligibleForPriceUp(oldProductWithNoSales)).toBe(false);
  });
});
