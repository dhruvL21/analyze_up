import { describe, it, expect } from 'vitest';
import { runDailyAILearning } from './daily-ai-learning';
import type { Product, Transaction } from '@/lib/types';

describe('Daily Adaptive AI Learning Engine with Tokenized Privacy', () => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const mockProducts: Product[] = [
    {
      id: 'p-1',
      name: 'Runner High Peak',
      sku: 'RHP-01',
      price: 4999,
      costPrice: 2499,
      stock: 12,
      minStock: 5,
    } as any,
    {
      id: 'p-2',
      name: 'Court Leather Sneaker',
      sku: 'CLS-02',
      price: 3499,
      costPrice: 1699,
      stock: 0,
      minStock: 10,
    } as any,
  ];

  const mockTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
    id: `order-${i}`,
    type: 'Sale',
    productId: i % 2 === 0 ? 'p-1' : 'p-2',
    sku: i % 2 === 0 ? 'RHP-01' : 'CLS-02',
    quantity: 1,
    totalRevenue: i % 2 === 0 ? 4999 : 3499,
    transactionDate: new Date(Date.now() - (i % 21) * MS_PER_DAY).toISOString(),
  } as any));

  it('runs daily learning cycle and returns structured observations with zero-PII guarantee', async () => {
    const record = await runDailyAILearning(mockProducts, mockTransactions, null, {
      currentDayNumber: 21,
      historicalDays: 21,
    });

    expect(record).toBeDefined();
    expect(record.dayNumber).toBe(21);
    expect(record.ordersAnalyzed).toBe(50);
    expect(record.skusAnalyzed).toBe(2);
    expect(record.dailyInsights.length).toBeGreaterThanOrEqual(1);
    expect(record.privacySanitizationVerified).toBe(true);
    expect(record.velocityMovers).toBeDefined();
    expect(record.recommendedTuning).toBeDefined();
  });
});
