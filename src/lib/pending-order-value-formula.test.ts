import { describe, it, expect } from 'vitest';
import { computeExecutiveKPIs } from './command-center-engine';
import { convertShopifyToCanonicalTransactions } from './ingestion/shopify-adapter';
import type { Product, Transaction } from './types';

describe('Pending Orders & Pending Order Total Suite', () => {
  const mockProduct: Product = {
    id: 'prod-100',
    name: 'Wireless Noise Cancelling Headphones',
    price: 3000,
    costPrice: 1800,
    stock: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('computes Pending Order Total using Subtotal + Delivery/Shipping + Tax - Discounts = Pending Order Value', () => {
    // 2 Distinct Pending Orders with full financial breakdown:
    // Order 1: Subtotal: 5000, Shipping: 200, Tax: 500, Discount: 300 => Final: 5400
    // Order 2: Subtotal: 3000, Shipping: 150, Tax: 300, Discount: 150 => Final: 3300
    // Expected Sum of final order totals = 5400 + 3300 = 8700
    const transactions: Transaction[] = [
      {
        id: 'tx-ord-1',
        orderNumber: 'ORD-1001',
        productId: 'prod-100',
        type: 'Sale',
        quantity: 1,
        price: 5000,
        totalRevenue: 5000,
        subtotal: 5000,
        shipping: 200,
        tax: 500,
        discount: 300,
        finalOrderTotal: 5400,
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PENDING',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: false,
        transactionDate: '2026-09-20',
        createdAt: '2026-09-20',
      },
      {
        id: 'tx-ord-2',
        orderNumber: 'ORD-1002',
        productId: 'prod-100',
        type: 'Sale',
        quantity: 1,
        price: 3000,
        totalRevenue: 3000,
        subtotal: 3000,
        shipping: 150,
        tax: 300,
        discount: 150,
        // Calculate dynamically from formula if finalOrderTotal not pre-provided
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PENDING',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: false,
        transactionDate: '2026-09-21',
        createdAt: '2026-09-21',
      },
    ];

    const kpis = computeExecutiveKPIs([mockProduct], transactions);
    const pendingKpi = kpis.find(k => k.key === 'pending_orders');

    // Title should be "Pending Order Total"
    expect(pendingKpi?.title).toBe('Pending Order Total');

    // Pending Order Total = 5400 + (3000 + 150 + 300 - 150 = 3300) = 8700
    expect(pendingKpi?.rawValue).toBe(8700);
    expect(pendingKpi?.count).toBe(2);
  });

  it('deduplicates multi-item orders so shipping, tax and discounts are not duplicated', () => {
    // 1 Pending Order with 2 line items:
    // Item 1: price 1500, qty 2 => 3000
    // Item 2: price 2000, qty 1 => 2000
    // Order breakdown: Subtotal 5000, Shipping 250, Tax 450, Discount 200 => Final Order Total = 5500
    const multiItemTransactions: Transaction[] = [
      {
        id: 'tx-item-1',
        orderNumber: 'ORD-9999',
        productId: 'prod-100',
        type: 'Sale',
        quantity: 2,
        price: 1500,
        totalRevenue: 3000,
        subtotal: 5000,
        shipping: 250,
        tax: 450,
        discount: 200,
        finalOrderTotal: 5500,
        fulfillmentStatus: 'UNFULFILLED',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: false,
        transactionDate: '2026-09-22',
        createdAt: '2026-09-22',
      },
      {
        id: 'tx-item-2',
        orderNumber: 'ORD-9999',
        productId: 'prod-100',
        type: 'Sale',
        quantity: 1,
        price: 2000,
        totalRevenue: 2000,
        subtotal: 5000,
        shipping: 250,
        tax: 450,
        discount: 200,
        finalOrderTotal: 5500,
        fulfillmentStatus: 'UNFULFILLED',
        status: 'Pending',
        isRevenueRecognized: false,
        paymentReceived: false,
        transactionDate: '2026-09-22',
        createdAt: '2026-09-22',
      },
    ];

    const kpis = computeExecutiveKPIs([mockProduct], multiItemTransactions);
    const pendingKpi = kpis.find(k => k.key === 'pending_orders');

    // Should count as 1 pending order with final order total 5500, NOT double counted
    expect(pendingKpi?.rawValue).toBe(5500);
    expect(pendingKpi?.count).toBe(1);
  });

  it('correctly maps Subtotal, Delivery/Shipping, Tax, Discounts, and Final Order Total in Shopify Adapter', () => {
    const mockShopifyOrders = [
      {
        id: 882910,
        order_number: 1042,
        name: '#1042',
        created_at: '2026-09-25T14:30:00Z',
        current_subtotal_price: '4200.00',
        total_shipping_price_set: {
          shop_money: { amount: '180.00', currency_code: 'INR' },
        },
        current_total_tax: '378.00',
        current_total_discounts: '258.00',
        total_price: '4500.00', // 4200 + 180 + 378 - 258 = 4500
        fulfillment_status: null,
        financial_status: 'pending',
        line_items: [
          {
            id: 111,
            title: 'Sneakers White',
            quantity: 1,
            price: '4200.00',
            sku: 'SNK-WHT',
          },
        ],
      },
    ];

    const txs = convertShopifyToCanonicalTransactions(mockShopifyOrders, {
      shop: 'snkhed.myshopify.com',
      storeName: 'SNKHED',
    });

    expect(txs).toHaveLength(1);
    const tx = txs[0];
    expect(tx.subtotal).toBe(4200);
    expect(tx.shipping).toBe(180);
    expect(tx.tax).toBe(378);
    expect(tx.discount).toBe(258);
    expect(tx.finalOrderTotal).toBe(4500);

    // Compute KPIs from this converted transaction
    const kpis = computeExecutiveKPIs([], txs);
    const pendingKpi = kpis.find(k => k.key === 'pending_orders');
    expect(pendingKpi?.title).toBe('Pending Order Total');
    expect(pendingKpi?.rawValue).toBe(4500);
    expect(pendingKpi?.count).toBe(1);
  });
});
