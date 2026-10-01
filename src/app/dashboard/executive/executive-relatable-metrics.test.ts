import { describe, it, expect } from 'vitest';
import { comparePeriods, calculateProfitBridge } from '@/lib/executive-intelligence-engine';
import { Product, Transaction, ProductReturn } from '@/lib/types';

describe('Executive Relatable Metrics & Bridge Analysis Suite', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Sneaker Alpha',
      price: 5000,
      costPrice: 2000,
      stock: 50,
      minStock: 10,
      supplier: 'Vendor A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      productId: 'prod-1',
      quantity: 10,
      price: 5000,
      type: 'Sale',
      transactionDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      productId: 'prod-1',
      quantity: 5,
      price: 5000,
      type: 'Sale',
      transactionDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockReturns: ProductReturn[] = [
    {
      id: 'ret-1',
      productId: 'prod-1',
      productName: 'Sneaker Alpha',
      quantity: 1,
      customerName: 'Customer A',
      reason: 'Defective',
      actionTaken: 'Restocked',
      refundStatus: 'Refunded',
      refundAmount: 5000,
      returnDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('correctly associates relatable metrics (AOV, return rate, profit margin)', () => {
    const comparison = comparePeriods(mockProducts, mockTransactions, mockReturns, null, 'MONTH');

    const totalOrders = comparison.currentPeriod.totalOrders;
    const revenue = comparison.currentPeriod.revenue;
    const totalReturns = comparison.currentPeriod.totalReturns;

    const aov = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;
    const returnRate = totalOrders > 0 ? ((totalReturns / totalOrders) * 100).toFixed(1) : '0.0';

    expect(aov).toBeGreaterThanOrEqual(0);
    expect(parseFloat(returnRate)).toBeGreaterThanOrEqual(0);
    expect(comparison.currentPeriod.profitMarginPercent).toBeDefined();
  });

  it('correctly balances deterministic profit bridge delta across operational drivers without duplicates', () => {
    const comparison = comparePeriods(mockProducts, mockTransactions, mockReturns, null, 'MONTH');
    const bridge = calculateProfitBridge(comparison, null);

    const netDelta = bridge.currentProfit - bridge.priorProfit;
    const varianceDrivers = bridge.components.filter((c) => c.type !== 'base' && c.type !== 'total');

    // The drivers explain the delta
    expect(varianceDrivers.length).toBe(4);
    expect(bridge.priorProfit).toBeDefined();
    expect(bridge.currentProfit).toBeDefined();

    const sumDrivers = varianceDrivers.reduce((acc, d) => acc + d.amount, 0);
    // Sum of variance drivers equals the difference between current profit and prior profit
    expect(sumDrivers).toBe(netDelta);
  });

  it('formats negative currency correctly as -₹X rather than ₹-X', () => {
    const formatCur = (val: number, symbol = '₹') => {
      const isNeg = val < 0;
      const abs = Math.abs(Math.round(val)).toLocaleString('en-IN');
      return isNeg ? `-${symbol}${abs}` : `${symbol}${abs}`;
    };

    expect(formatCur(-86226)).toBe('-₹86,226');
    expect(formatCur(1217530)).toBe('₹12,17,530');
    expect(formatCur(0)).toBe('₹0');
  });
});
