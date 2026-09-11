import { describe, it, expect } from 'vitest';
import {
  parseShopifyProducts,
  parseShopifyOrders,
  convertShopifyToCanonicalProducts,
  convertShopifyToCanonicalTransactions,
  convertShopifyToCanonicalReturns,
  convertShopifyGraphQLReturnsToCanonical,
  mergeAndDeduplicateReturns,
  determineReturnReason,
} from './shopify-adapter';

describe('Shopify Adapter & Ingestion Engine', () => {
  const mockShopifyProducts = [
    {
      id: 8001,
      title: 'Premium Wireless Headphones',
      product_type: 'Electronics',
      vendor: 'SoundCore Audio',
      body_html: '<p>High-end active noise cancellation headphones.</p>',
      variants: [
        {
          id: 9001,
          title: 'Matte Black',
          price: '4999.00',
          cost: '2499.00',
          sku: 'SKU-HEAD-BLK',
          inventory_quantity: 45,
        },
        {
          id: 9002,
          title: 'Silver Edition',
          price: '5499.00',
          sku: 'SKU-HEAD-SLV',
          inventory_quantity: 12,
        },
      ],
    },
    {
      id: 8002,
      title: 'Ergonomic Mousepad',
      product_type: 'Accessories',
      vendor: 'DeskPro',
      variants: [
        {
          id: 9003,
          price: '699.00',
          sku: 'SKU-PAD-01',
          inventory_quantity: 80,
        },
      ],
    },
  ];

  const mockShopifyOrders = [
    {
      id: 7001,
      name: '#1001',
      order_number: 1001,
      created_at: '2026-08-25T14:30:00Z',
      gateway: 'Shopify Payments',
      customer: {
        first_name: 'Aditi',
        last_name: 'Verma',
        email: 'aditi@example.com',
      },
      line_items: [
        {
          id: 6001,
          title: 'Premium Wireless Headphones - Matte Black',
          sku: 'SKU-HEAD-BLK',
          price: '4999.00',
          quantity: 2,
        },
        {
          id: 6002,
          title: 'Ergonomic Mousepad',
          sku: 'SKU-PAD-01',
          price: '699.00',
          quantity: 1,
        },
      ],
    },
  ];

  it('parses raw products into tabular rows for mapping wizard', () => {
    const parsed = parseShopifyProducts(mockShopifyProducts);
    expect(parsed.rowCount).toBe(3); // 2 variants for headphones + 1 variant for mousepad
    expect(parsed.headers).toContain('Shopify Product ID');
    expect(parsed.headers).toContain('Item Title');
    expect(parsed.headers).toContain('SKU Code');
    expect(parsed.rows[0]['SKU Code']).toBe('SKU-HEAD-BLK');
    expect(parsed.rows[1]['SKU Code']).toBe('SKU-HEAD-SLV');
  });

  it('parses raw orders into tabular rows', () => {
    const parsed = parseShopifyOrders(mockShopifyOrders);
    expect(parsed.rowCount).toBe(2); // 2 line items
    expect(parsed.rows[0]['Order Number']).toBe('#1001');
    expect(parsed.rows[0]['Customer Name']).toBe('Aditi Verma');
    expect(parsed.rows[0]['Quantity Sold']).toBe('2');
    expect(parsed.rows[0]['Total Order Revenue']).toBe('9998');
  });

  it('converts raw Shopify products into canonical Product objects', () => {
    const canonical = convertShopifyToCanonicalProducts(mockShopifyProducts);
    expect(canonical.length).toBe(3);

    const item1 = canonical[0];
    expect(item1.id).toBe('shopify_8001_9001');
    expect(item1.name).toContain('Matte Black');
    expect(item1.sku).toBe('SKU-HEAD-BLK');
    expect(item1.price).toBe(4999);
    expect(item1.costPrice).toBe(2499);
    expect(item1.stock).toBe(45);
    expect(item1.supplier).toBe('SoundCore Audio');
    expect(item1.source).toBe('SHOPIFY');

    // Default cost estimation when variant cost is absent
    const item2 = canonical[1];
    expect(item2.costPrice).toBe(Math.round(5499 * 0.6));
  });

  it('converts raw Shopify orders into canonical Transaction objects', () => {
    const canonical = convertShopifyToCanonicalTransactions(mockShopifyOrders);
    expect(canonical.length).toBe(2);

    const tx1 = canonical[0];
    expect(tx1.orderNumber).toBe('#1001');
    expect(tx1.transactionDate).toBe('2026-08-25');
    expect(tx1.customerName).toBe('Aditi Verma');
    expect(tx1.sku).toBe('SKU-HEAD-BLK');
    expect(tx1.type).toBe('Sale');
    expect(tx1.quantity).toBe(2);
    expect(tx1.price).toBe(4999);
    expect(tx1.totalRevenue).toBe(9998);
    expect(tx1.paymentMethod).toBe('Shopify Payments');
  });

  it('converts nested Shopify order refunds into canonical ProductReturn objects', () => {
    const ordersWithRefunds = [
      {
        id: 7001,
        name: '#1001',
        order_number: 1001,
        created_at: '2026-08-25T14:30:00Z',
        customer: { first_name: 'Aditi', last_name: 'Verma' },
        refunds: [
          {
            id: 901,
            order_id: 7001,
            created_at: '2026-08-27T10:00:00Z',
            note: 'Customer reported sound is defective in left earcup',
            restock: false,
            refund_line_items: [
              {
                id: 501,
                quantity: 1,
                restock_type: 'no_restock',
                subtotal: 4999.00,
                line_item: {
                  id: 6001,
                  product_id: 8001,
                  variant_id: 9001,
                  title: 'Premium Wireless Headphones - Matte Black',
                  sku: 'SKU-HEAD-BLK',
                  price: '4999.00',
                },
              },
            ],
          },
        ],
      },
    ];

    const returns = convertShopifyToCanonicalReturns(ordersWithRefunds);
    expect(returns.length).toBe(1);

    const ret = returns[0];
    expect(ret.id).toBe('ret_shopify_7001_901_501');
    expect(ret.productId).toBe('shopify_8001_9001');
    expect(ret.productName).toBe('Premium Wireless Headphones - Matte Black');
    expect(ret.sku).toBe('SKU-HEAD-BLK');
    expect(ret.orderNumber).toBe('#1001');
    expect(ret.quantity).toBe(1);
    expect(ret.customerName).toBe('Aditi Verma');
    expect(ret.reason).toBe('Defective');
    expect(ret.actionTaken).toBe('Disposed / Written Off');
    expect(ret.refundStatus).toBe('Refunded');
    expect(ret.refundAmount).toBe(4999);
    expect(ret.returnDate).toBe('2026-08-27');
    expect(ret.source).toBe('SHOPIFY');
  });

  it('converts standalone webhook refund payload (refunds/create topic)', () => {
    const standaloneRefundPayload = [
      {
        id: 902,
        order_id: 7002,
        created_at: '2026-08-28T16:00:00Z',
        note: 'Wrong size ordered, customer returned unopened box',
        restock: true,
        refund_line_items: [
          {
            id: 502,
            quantity: 2,
            restock_type: 'return',
            subtotal: 1398.00,
            line_item: {
              id: 6003,
              product_id: 8002,
              variant_id: 9003,
              title: 'Ergonomic Mousepad',
              sku: 'SKU-PAD-01',
              price: '699.00',
            },
          },
        ],
      },
    ];

    const returns = convertShopifyToCanonicalReturns(standaloneRefundPayload);
    expect(returns.length).toBe(1);

    const ret = returns[0];
    expect(ret.id).toBe('ret_shopify_7002_902_502');
    expect(ret.productId).toBe('shopify_8002_9003');
    expect(ret.quantity).toBe(2);
    expect(ret.refundAmount).toBe(1398);
    expect(ret.reason).toBe('Wrong Item');
    expect(ret.actionTaken).toBe('Restocked');
    expect(ret.refundStatus).toBe('Refunded');
  });

  it('handles monetary refunds without line items as general order refund', () => {
    const monetaryRefundOrder = [
      {
        id: 7003,
        name: '#1003',
        created_at: '2026-08-29T12:00:00Z',
        customer: { first_name: 'Rahul', last_name: 'Sharma' },
        refunds: [
          {
            id: 903,
            order_id: 7003,
            created_at: '2026-08-30T15:00:00Z',
            note: 'Buyer remorse cancellation before shipment',
            transactions: [
              {
                id: 401,
                kind: 'refund',
                amount: '1500.00',
                status: 'success',
              },
            ],
          },
        ],
      },
    ];

    const returns = convertShopifyToCanonicalReturns(monetaryRefundOrder);
    expect(returns.length).toBe(1);

    const ret = returns[0];
    expect(ret.id).toBe('ret_shopify_7003_903_monetary');
    expect(ret.refundAmount).toBe(1500);
    expect(ret.reason).toBe('Unopened / Buyer Remorse');
    expect(ret.refundStatus).toBe('Refunded');
    expect(ret.customerName).toBe('Rahul Sharma');
  });

  it('converts Shopify GraphQL Return nodes (utilizing read_returns scope) into canonical returns', () => {
    const mockGraphQLReturns = [
      {
        id: 'gid://shopify/Return/9901',
        name: '#1001-R1',
        status: 'CLOSED',
        createdAt: '2026-08-30T10:00:00Z',
        totalQuantity: 1,
        order: {
          id: 'gid://shopify/Order/7001',
          name: '#1001',
          customer: {
            firstName: 'Kavita',
            lastName: 'Patel',
          },
        },
        returnLineItems: {
          nodes: [
            {
              id: 'gid://shopify/ReturnLineItem/8801',
              quantity: 1,
              returnReason: 'DEFECTIVE',
              returnReasonNote: 'Device will not power on after 2 days',
              fulfillmentLineItem: {
                id: 'gid://shopify/FulfillmentLineItem/4401',
                lineItem: {
                  id: 'gid://shopify/LineItem/6001',
                  title: 'Premium Wireless Headphones - Matte Black',
                  sku: 'SKU-HEAD-BLK',
                  originalUnitPriceSet: {
                    shopMoney: {
                      amount: '4999.00',
                    },
                  },
                  product: {
                    id: 'gid://shopify/Product/8001',
                    title: 'Premium Wireless Headphones',
                  },
                  variant: {
                    id: 'gid://shopify/ProductVariant/9001',
                    title: 'Matte Black',
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const returns = convertShopifyGraphQLReturnsToCanonical(mockGraphQLReturns);
    expect(returns.length).toBe(1);

    const ret = returns[0];
    expect(ret.id).toBe('ret_shopify_gql_9901_8801');
    expect(ret.productId).toBe('shopify_8001_9001');
    expect(ret.productName).toBe('Premium Wireless Headphones - Matte Black');
    expect(ret.sku).toBe('SKU-HEAD-BLK');
    expect(ret.orderNumber).toBe('#1001');
    expect(ret.customerName).toBe('Kavita Patel');
    expect(ret.quantity).toBe(1);
    expect(ret.refundAmount).toBe(4999);
    expect(ret.reason).toBe('Defective');
    expect(ret.actionTaken).toBe('Disposed / Written Off');
    expect(ret.refundStatus).toBe('Refunded');
    expect(ret.returnDate).toBe('2026-08-30');
    expect(ret.source).toBe('SHOPIFY');
  });

  it('merges and deduplicates GraphQL returns and REST order refunds', () => {
    const orderReturns = [
      {
        id: 'ret_shopify_7001_901_501',
        productId: 'shopify_8001_9001',
        productName: 'Premium Wireless Headphones - Matte Black',
        sku: 'SKU-HEAD-BLK',
        orderNumber: '#1001',
        quantity: 1,
        customerName: 'Kavita Patel',
        reason: 'Defective' as const,
        actionTaken: 'Disposed / Written Off' as const,
        refundStatus: 'Refunded' as const,
        refundAmount: 4999,
        returnDate: '2026-08-30',
        source: 'SHOPIFY' as const,
        createdAt: '2026-08-30',
        updatedAt: '2026-08-30',
      },
    ];

    const graphQLReturns = [
      {
        id: 'ret_shopify_gql_9901_8801',
        productId: 'shopify_8001_9001',
        productName: 'Premium Wireless Headphones - Matte Black',
        sku: 'SKU-HEAD-BLK',
        orderNumber: '#1001',
        quantity: 1,
        customerName: 'Kavita Patel',
        reason: 'Defective' as const,
        actionTaken: 'Disposed / Written Off' as const,
        refundStatus: 'Refunded' as const,
        refundAmount: 4999,
        returnDate: '2026-08-30',
        source: 'SHOPIFY' as const,
        createdAt: '2026-08-30',
        updatedAt: '2026-08-30',
      },
    ];

    const merged = mergeAndDeduplicateReturns(orderReturns, graphQLReturns);
    // Should deduplicate since both refer to #1001 and SKU-HEAD-BLK
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('ret_shopify_gql_9901_8801');
  });

  describe('determineReturnReason classification', () => {
    it('classifies defective keywords accurately', () => {
      expect(determineReturnReason('Product has a defect')).toBe('Defective');
      expect(determineReturnReason('Broken on arrival')).toBe('Defective');
      expect(determineReturnReason('Item malfunctioning')).toBe('Defective');
      expect(determineReturnReason('Poor quality fabric torn')).toBe('Defective');
    });

    it('classifies shipping and transit damage accurately', () => {
      expect(determineReturnReason('Box crushed in transit')).toBe('Damaged in Transit');
      expect(determineReturnReason('Delivery courier damaged the package')).toBe('Damaged in Transit');
      expect(determineReturnReason('Arrived damaged')).toBe('Damaged in Transit');
    });

    it('classifies wrong item, sizing, and mismatch accurately', () => {
      expect(determineReturnReason('Wrong size sent, too large')).toBe('Wrong Item');
      expect(determineReturnReason('Color mismatch, wanted blue')).toBe('Wrong Item');
      expect(determineReturnReason('Not as described in pictures')).toBe('Wrong Item');
    });

    it('classifies customer remorse, accidental order, and cancellations', () => {
      expect(determineReturnReason('Customer changed mind')).toBe('Unopened / Buyer Remorse');
      expect(determineReturnReason('Accidental purchase, no longer needed')).toBe('Unopened / Buyer Remorse');
      expect(determineReturnReason('Buyer remorse unopened')).toBe('Unopened / Buyer Remorse');
    });

    it('infers reason from restock status when note is missing or generic', () => {
      // Restocked returns are resalable -> Unopened / Buyer Remorse
      expect(determineReturnReason('', 'return', true)).toBe('Unopened / Buyer Remorse');
      expect(determineReturnReason(undefined, 'cancel', true)).toBe('Unopened / Buyer Remorse');

      // Discarded / written-off returns without note -> Defective
      expect(determineReturnReason('', 'no_restock', false)).toBe('Defective');

      // Generic unclassified returns default to Unopened / Buyer Remorse instead of Other
      expect(determineReturnReason('Shopify return #1234')).toBe('Unopened / Buyer Remorse');
      expect(determineReturnReason('')).toBe('Unopened / Buyer Remorse');
    });
  });
});

