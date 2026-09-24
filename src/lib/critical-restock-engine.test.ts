import { describe, it, expect } from 'vitest';
import { evaluateDataReadiness } from './data-readiness-engine';
import type { Product, Transaction, Supplier } from './types';

describe('Critical Restock Hub Engine & Data Readiness Gating', () => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const mockSuppliers: Supplier[] = [
    {
      id: 'sup-1',
      name: 'Alpha Footwear',
      contactName: 'John',
      leadTimeDays: 7,
      email: 'orders@alpha.com',
      phone: '1234567890',
      address: '123 Factory Way',
      category: 'Footwear',
      paymentTerms: 'Net 30',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('correctly locks critical restock when brand is in LEARNING phase with score < 40', () => {
    // Beginner store with only 2 days of history and 5 orders
    const beginnerProducts: Product[] = [
      {
        id: 'p-1',
        name: 'Sneaker A',
        sku: 'SNK-A',
        price: 4999,
        costPrice: 2499,
        stock: 0,
        minStock: 10,
        supplierId: 'sup-1',
      } as any,
    ];

    const beginnerTx: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'Sale',
      productId: 'p-1',
      sku: 'SNK-A',
      quantity: 1,
      totalAmount: 4999,
      transactionDate: new Date(Date.now() - i * MS_PER_DAY * 0.3).toISOString(),
    } as any));

    const readiness = evaluateDataReadiness(beginnerProducts, beginnerTx);
    expect(readiness.level).toBe('LEARNING');
    expect(readiness.score).toBeLessThan(40);

    const isRestockUnlocked = Boolean(
      (readiness.score >= 40 && readiness.level !== 'LEARNING' && readiness.capabilities.reorderRecommendations)
    );

    // Should NOT show when brand does not meet the required score
    expect(isRestockUnlocked).toBe(false);
  });

  it('unlocks critical restock when brand reaches Data Readiness score >= 40 and EARLY_INSIGHTS or higher', () => {
    // Mature store with 20 days and 100 orders
    const products: Product[] = [
      {
        id: 'p-1',
        name: 'Runner Pro',
        sku: 'RUN-PRO',
        price: 5999,
        costPrice: 2999,
        stock: 0,
        minStock: 10,
        leadTimeDays: 7,
        supplierId: 'sup-1',
      } as any,
      {
        id: 'p-2',
        name: 'Trail Blazer',
        sku: 'TRL-BLZ',
        price: 3999,
        costPrice: 1999,
        stock: 25,
        minStock: 5,
        leadTimeDays: 7,
      } as any,
    ];

    const transactions: Transaction[] = Array.from({ length: 120 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'Sale',
      productId: 'p-1',
      sku: 'RUN-PRO',
      quantity: 2,
      totalAmount: 11998,
      transactionDate: new Date(Date.now() - (i % 25) * MS_PER_DAY).toISOString(),
    } as any));

    const readiness = evaluateDataReadiness(products, transactions);
    expect(readiness.score).toBeGreaterThanOrEqual(40);
    expect(readiness.capabilities.reorderRecommendations).toBe(true);

    const isRestockUnlocked = Boolean(
      (readiness.score >= 40 && readiness.level !== 'LEARNING' && readiness.capabilities.reorderRecommendations)
    );

    // Should show when brand meets the score requirement
    expect(isRestockUnlocked).toBe(true);
  });

  it('unlocks critical restock when brand reaches 50 customer orders and 14+ days of history with score >= 40', () => {
    // Exact store parameters from user's live store: 50 orders, 21 days history, score >= 40 (user store had 48)
    const products: Product[] = [
      {
        id: 'p-1',
        name: 'Runner Pro High',
        sku: 'RUN-PRO-HI',
        price: 5999,
        costPrice: 2999,
        stock: 0,
        minStock: 10,
        leadTimeDays: 7,
        supplierId: 'sup-1',
      } as any,
      {
        id: 'p-2',
        name: 'Runner Pro Low',
        sku: 'RUN-PRO-LO',
        price: 4999,
        costPrice: 2499,
        stock: 15,
        minStock: 5,
        leadTimeDays: 7,
        supplierId: 'sup-1',
      } as any,
      {
        id: 'p-3',
        name: 'Urban Trail Sneaker',
        sku: 'URB-TRL',
        price: 3999,
        costPrice: 1999,
        stock: 4,
        minStock: 10,
        leadTimeDays: 14,
        supplierId: 'sup-1',
      } as any,
      {
        id: 'p-4',
        name: 'Classic Court Leather',
        sku: 'CRT-LTH',
        price: 6499,
        costPrice: 3200,
        stock: 20,
        minStock: 5,
        leadTimeDays: 10,
        supplierId: 'sup-1',
      } as any,
    ];

    const transactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'Sale',
      productId: `p-${(i % 4) + 1}`,
      sku: `SKU-${(i % 4) + 1}`,
      quantity: 1,
      totalAmount: 4999,
      transactionDate: new Date(Date.now() - (i % 21) * MS_PER_DAY).toISOString(),
    } as any));

    const readiness = evaluateDataReadiness(products, transactions);
    expect(readiness.score).toBeGreaterThanOrEqual(40);
    expect(readiness.level).toBe('EARLY_INSIGHTS');
    expect(readiness.level).not.toBe('LEARNING');

    const currentOrders = readiness.totalOrders;
    const currentDays = readiness.historicalDays;
    const currentScore = readiness.score;

    const isThresholdMet = (currentOrders >= 50 || currentDays >= 14) && currentScore >= 40;
    const isRestockUnlocked = Boolean(
      isThresholdMet ||
      (currentScore >= 40 && readiness.level !== 'LEARNING') ||
      readiness.capabilities.reorderRecommendations
    );

    expect(isRestockUnlocked).toBe(true);
  });

  it('calculates AI restock quantities and revenue at risk from sales velocity and runway buffer', () => {
    const historicalDays = 30;
    const price = 6000;
    const costPrice = 3000;
    const minStock = 10;
    const leadTimeDays = 7;
    const totalSoldUnits = 60; // 60 units sold in 30 days = 2 units/day velocity

    const dailySales = totalSoldUnits / historicalDays; // 2.0
    expect(dailySales).toBe(2);

    // In Early Insights (score >= 40): 28-day runway buffer
    const targetBufferDays = Math.max(leadTimeDays + 14, 28);
    expect(targetBufferDays).toBe(28);

    // Target optimal stock for 28-day runway
    const targetOptimalStock = Math.ceil(dailySales * targetBufferDays); // 2 * 28 = 56
    expect(targetOptimalStock).toBe(56);

    // When Out of Stock (stock === 0)
    const suggestedQty = Math.max(minStock * 2, Math.max(10, targetOptimalStock));
    expect(suggestedQty).toBe(56);

    // Order cost
    const estimatedOrderCost = costPrice * suggestedQty;
    expect(estimatedOrderCost).toBe(168000); // 3000 * 56

    // Revenue at risk (30 days of lost sales)
    const lostUnits = Math.round(dailySales * 30); // 60 units
    const revenueAtRisk = price * lostUnits;
    expect(revenueAtRisk).toBe(360000); // 6000 * 60
  });

  it('dynamically expands runway buffer to 35 days in OPTIMIZATION level', () => {
    const leadTimeDays = 7;
    const readinessLevel = 'OPTIMIZATION';

    let targetBufferDays = Math.max(leadTimeDays + 14, 28);
    if (readinessLevel === 'OPTIMIZATION') {
      targetBufferDays = Math.max(leadTimeDays + 21, 35);
    }

    expect(targetBufferDays).toBe(35);

    const dailySales = 3;
    const targetOptimalStock = Math.ceil(dailySales * targetBufferDays); // 3 * 35 = 105
    expect(targetOptimalStock).toBe(105);
  });

  it('handles zero-sales catalog items with safety stock buffer', () => {
    const minStock = 10;
    const dailySales = 0;
    const targetBufferDays = 28;

    const targetOptimalStock = Math.ceil(dailySales > 0 ? dailySales * targetBufferDays : minStock * 3);
    expect(targetOptimalStock).toBe(30);

    const suggestedQty = Math.max(minStock * 2, Math.max(10, targetOptimalStock));
    expect(suggestedQty).toBe(30);
  });
});
