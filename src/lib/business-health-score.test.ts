import { describe, it, expect } from 'vitest';
import { computeBusinessHealth } from './command-center-engine';
import type { Product, Transaction, Supplier, PurchaseOrder, ProductReturn } from './types';

describe('AnalyzeUp — 6-Metric Business Health Score Engine', () => {
  const mockProducts: Product[] = [
    {
      id: 'p1',
      name: 'Organic Cotton Shirt',
      sku: 'SHIRT-01',
      price: 1500,
      costPrice: 750, // 50% margin
      stock: 45,
      minStock: 10,
      leadTimeDays: 4,
    } as any,
    {
      id: 'p2',
      name: 'Raw Denim Jeans',
      sku: 'JEANS-01',
      price: 2500,
      costPrice: 1250, // 50% margin
      stock: 30,
      minStock: 10,
      leadTimeDays: 5,
    } as any,
    {
      id: 'p3',
      name: 'Leather Belt',
      sku: 'BELT-01',
      price: 800,
      costPrice: 400, // 50% margin
      stock: 0, // out of stock
      minStock: 5,
      leadTimeDays: 7,
    } as any,
    {
      id: 'p4',
      name: 'Suede Loafers',
      sku: 'SHOE-01',
      price: 3500,
      costPrice: 1750, // 50% margin
      stock: 2, // low stock (< minStock)
      minStock: 8,
      leadTimeDays: 6,
    } as any,
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 't1',
      type: 'Sale',
      productId: 'p1',
      quantity: 5,
      price: 1500,
      totalRevenue: 7500,
      totalCost: 3750,
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      transactionDate: new Date(Date.now() - 40 * 86400000).toISOString(),
    } as any,
    {
      id: 't2',
      type: 'Sale',
      productId: 'p2',
      quantity: 3,
      price: 2500,
      totalRevenue: 7500,
      totalCost: 3750,
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      transactionDate: new Date(Date.now() - 15 * 86400000).toISOString(),
    } as any,
    {
      id: 't3',
      type: 'Sale',
      productId: 'p4',
      quantity: 2,
      price: 3500,
      totalRevenue: 7000,
      totalCost: 3500,
      financialStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      transactionDate: new Date().toISOString(),
    } as any,
  ];

  const mockSuppliers: Supplier[] = [
    { id: 's1', name: 'Textile Mills Ltd', leadTimeDays: 4 } as any,
  ];

  const mockOrders: PurchaseOrder[] = [
    {
      id: 'po1',
      supplierId: 's1',
      productId: 'p1',
      quantity: 50,
      status: 'Fulfilled',
      orderDate: new Date().toISOString(),
    } as any,
    {
      id: 'po2',
      supplierId: 's1',
      productId: 'p2',
      quantity: 30,
      status: 'Delivered',
      orderDate: new Date().toISOString(),
    } as any,
  ];

  const mockReturns: ProductReturn[] = [];

  it('1. Computes all 6 distinct health metrics with valid ranges [0-100]', () => {
    const health = computeBusinessHealth(
      mockProducts,
      mockTransactions,
      mockSuppliers,
      mockReturns,
      mockOrders
    );

    expect(health.factors).toBeDefined();
    expect(health.factors.inventoryHealth).toBeGreaterThanOrEqual(0);
    expect(health.factors.inventoryHealth).toBeLessThanOrEqual(100);

    expect(health.factors.profitability).toBeGreaterThanOrEqual(0);
    expect(health.factors.profitability).toBeLessThanOrEqual(100);

    expect(health.factors.salesRevenueHealth).toBeGreaterThanOrEqual(0);
    expect(health.factors.salesRevenueHealth).toBeLessThanOrEqual(100);

    expect(health.factors.capitalEfficiency).toBeGreaterThanOrEqual(0);
    expect(health.factors.capitalEfficiency).toBeLessThanOrEqual(100);

    expect(health.factors.supplierPerformance).toBeGreaterThanOrEqual(0);
    expect(health.factors.supplierPerformance).toBeLessThanOrEqual(100);

    expect(health.factors.orderFulfillmentHealth).toBeGreaterThanOrEqual(0);
    expect(health.factors.orderFulfillmentHealth).toBeLessThanOrEqual(100);

    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it('2. Inventory Health reflects in-stock, low-stock buffer, and out-of-stock items', () => {
    // 4 products: 2 in stock (100%), 1 low stock (60%), 1 out of stock (0%)
    // Expected: ((2*100) + (1*60) + 0) / 4 = 260 / 4 = 65%
    const health = computeBusinessHealth(mockProducts, mockTransactions);
    expect(health.factors.inventoryHealth).toBe(65);
  });

  it('3. Profitability reflects gross profit margins vs COGS and return costs', () => {
    const health = computeBusinessHealth(mockProducts, mockTransactions);
    // Margins are 50%. Since 45% benchmark gives 100, 50% hits the max 100%.
    expect(health.factors.profitability).toBe(100);
    expect(health.factors.marginHealth).toBe(100); // Backwards compatibility check
  });

  it('4. Order / Fulfillment Health recognizes paid & fulfilled orders and reflects return drag', () => {
    const healthClean = computeBusinessHealth(mockProducts, mockTransactions, [], []);
    expect(healthClean.factors.orderFulfillmentHealth).toBe(100);

    // Add return to evaluate return drag
    const testReturns: ProductReturn[] = [
      { id: 'r1', productId: 'p1', refundStatus: 'Refunded', refundAmount: 1500 } as any,
    ];
    const healthWithReturns = computeBusinessHealth(mockProducts, mockTransactions, [], testReturns);
    expect(healthWithReturns.factors.orderFulfillmentHealth).toBeLessThan(100);
  });

  it('5. Supplier Performance incorporates purchase order delivery completion', () => {
    // Without POs (lead time only, avg lead ~5.5d)
    const healthWithoutPOs = computeBusinessHealth(mockProducts, mockTransactions, mockSuppliers, [], []);
    // With 100% delivered POs
    const healthWithDeliveredPOs = computeBusinessHealth(mockProducts, mockTransactions, mockSuppliers, [], mockOrders);

    expect(healthWithDeliveredPOs.factors.supplierPerformance).toBeGreaterThanOrEqual(
      healthWithoutPOs.factors.supplierPerformance
    );
  });

  it('6. Preserves graceful fallback for empty inventory dataset', () => {
    const emptyHealth = computeBusinessHealth([], []);
    expect(emptyHealth.score).toBe(0);
    expect(emptyHealth.category).toBe('Needs Attention');
    expect(emptyHealth.factors.inventoryHealth).toBe(0);
    expect(emptyHealth.factors.profitability).toBe(0);
    expect(emptyHealth.factors.salesRevenueHealth).toBe(0);
    expect(emptyHealth.factors.capitalEfficiency).toBe(0);
    expect(emptyHealth.factors.supplierPerformance).toBe(0);
    expect(emptyHealth.factors.orderFulfillmentHealth).toBe(0);
  });
});
