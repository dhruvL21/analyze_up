import { describe, it, expect } from 'vitest';
import { computeExecutiveKPIs } from './command-center-engine';
import { toDomainTransactions } from './domain-adapters';
import type { Product, Transaction } from './types';

describe('Earned Revenue Recognition Model', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Running Shoes - Red',
      category: 'Footwear',
      price: 2000,
      costPrice: 1200,
      stock: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-2',
      name: 'Running Shoes - Blue',
      category: 'Footwear',
      price: 3000,
      costPrice: 1800,
      stock: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('does NOT count placed/unfulfilled orders as recognized revenue or profit, but tracks them as Pending Orders', () => {
    const rawTransactions: Transaction[] = [
      // Placed order 1: Unfulfilled, but Paid (Advance payment)
      {
        id: 'tx-1',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 2,
        price: 2000,
        totalRevenue: 4000,
        costPerUnit: 1200,
        totalCost: 2400,
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PAID',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: true,
        transactionDate: '2026-09-10',
        createdAt: '2026-09-10',
      },
      // Placed order 2: Unfulfilled and Unpaid (COD / Pending)
      {
        id: 'tx-2',
        productId: 'prod-2',
        type: 'Sale',
        quantity: 1,
        price: 3000,
        totalRevenue: 3000,
        costPerUnit: 1800,
        totalCost: 1800,
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PENDING',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: false,
        transactionDate: '2026-09-11',
        createdAt: '2026-09-11',
      },
    ];

    const kpis = computeExecutiveKPIs(mockProducts, rawTransactions);
    const kpiMap = new Map(kpis.map(k => [k.key, k]));

    // 1. Recognized Revenue must be 0 because 0 orders have been fulfilled/delivered
    expect(kpiMap.get('revenue')?.rawValue).toBe(0);

    // 2. Realized Net Profit must be 0
    expect(kpiMap.get('net_profit')?.rawValue).toBe(0);

    // 3. Pending Order Pipeline must track both unfulfilled placed orders (4000 + 3000 = 7000)
    expect(kpiMap.get('pending_orders')?.rawValue).toBe(7000);

    // 4. Payments Received tracks only confirmed paid orders (4000)
    expect(kpiMap.get('payments_received')?.rawValue).toBe(4000);
  });

  it('recognizes revenue and profit once the order is fulfilled or delivered', () => {
    const rawTransactions: Transaction[] = [
      // Fulfilled Order: Delivered to customer, Paid
      {
        id: 'tx-fulfilled',
        productId: 'prod-1',
        type: 'Sale',
        quantity: 3,
        price: 2000,
        totalRevenue: 6000,
        costPerUnit: 1200,
        totalCost: 3600,
        fulfillmentStatus: 'FULFILLED',
        financialStatus: 'PAID',
        status: 'Delivered',
        isRevenueRecognized: true,
        paymentReceived: true,
        transactionDate: '2026-09-12',
        createdAt: '2026-09-12',
      },
      // Placed Order: Still awaiting fulfillment
      {
        id: 'tx-pending',
        productId: 'prod-2',
        type: 'Sale',
        quantity: 1,
        price: 3000,
        totalRevenue: 3000,
        costPerUnit: 1800,
        totalCost: 1800,
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PAID',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: true,
        transactionDate: '2026-09-13',
        createdAt: '2026-09-13',
      },
    ];

    const kpis = computeExecutiveKPIs(mockProducts, rawTransactions);
    const kpiMap = new Map(kpis.map(k => [k.key, k]));

    // Recognized Revenue only counts the fulfilled order (6000), not the 3000 pending order
    expect(kpiMap.get('revenue')?.rawValue).toBe(6000);

    // Realized Profit = 6000 - 3600 = 2400
    expect(kpiMap.get('net_profit')?.rawValue).toBe(2400);

    // Pending Orders pipeline = 3000
    expect(kpiMap.get('pending_orders')?.rawValue).toBe(3000);

    // Payments Received tracks both paid orders (6000 + 3000 = 9000)
    expect(kpiMap.get('payments_received')?.rawValue).toBe(9000);
  });

  it('preserves fulfillment and payment fields across domain transformation', () => {
    const domainTx = toDomainTransactions([
      {
        id: 'tx-test',
        productId: 'p1',
        type: 'Sale',
        quantity: 1,
        price: 1000,
        fulfillmentStatus: 'FULFILLED',
        financialStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        isRevenueRecognized: true,
        paymentReceived: true,
        transactionDate: '2026-09-15',
        createdAt: '2026-09-15',
      },
    ]);

    expect(domainTx[0].fulfillmentStatus).toBe('FULFILLED');
    expect(domainTx[0].financialStatus).toBe('PAID');
    expect(domainTx[0].deliveryStatus).toBe('DELIVERED');
    expect(domainTx[0].isRevenueRecognized).toBe(true);
    expect(domainTx[0].paymentReceived).toBe(true);
  });
});
