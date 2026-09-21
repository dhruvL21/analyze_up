import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { POST as handleWebhook } from '@/app/api/shopify/webhooks/route';
import { POST as handleInventoryAdjust } from '@/app/api/shopify/inventory/adjust/route';
import { POST as handleOrderCreate } from '@/app/api/shopify/orders/create/route';
import { saveShopifyConnection, getShopifyConnection } from './connection-store';
import { encryptShopifyToken } from './crypto';
import { getShopifyApiVersion } from './config';
import type { ShopifyConnectionRecord } from './types';

// Mock in-memory Firestore database
const mockDb = new Map<string, any>();

vi.mock('@/lib/firebase/admin', () => {
  class PersistenceError extends Error {
    public readonly code: string;
    public readonly details?: any;
    constructor(code: string, message: string, details?: any) {
      super(`[PersistenceError ${code}]: ${message}`);
      this.name = 'PersistenceError';
      this.code = code;
      this.details = details;
    }
  }

  const createDocRef = (collectionPath: string, docId: string) => {
    const fullPath = `${collectionPath}/${docId}`;
    return {
      id: docId,
      path: fullPath,
      get: async () => {
        const data = mockDb.get(fullPath);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
      set: async (data: any, options?: any) => {
        if (options?.merge && mockDb.has(fullPath)) {
          const existing = mockDb.get(fullPath);
          mockDb.set(fullPath, { ...existing, ...data });
        } else {
          mockDb.set(fullPath, data);
        }
      },
      update: async (data: any) => {
        const existing = mockDb.get(fullPath) || {};
        mockDb.set(fullPath, { ...existing, ...data });
      },
    };
  };

  const createCollectionRef = (collectionPath: string) => ({
    doc: (docId: string) => ({
      ...createDocRef(collectionPath, docId),
      collection: (subColl: string) => createCollectionRef(`${collectionPath}/${docId}/${subColl}`),
    }),
    where: (field: string, _op: string, val: any) => ({
      get: async () => {
        const docs: any[] = [];
        for (const [key, value] of mockDb.entries()) {
          if (key.startsWith(`${collectionPath}/`) && value && value[field] === val) {
            docs.push({
              id: key.replace(`${collectionPath}/`, ''),
              data: () => value,
            });
          }
        }
        return { empty: docs.length === 0, docs };
      },
    }),
    get: async () => {
      const docs: any[] = [];
      for (const [key, value] of mockDb.entries()) {
        if (key.startsWith(`${collectionPath}/`)) {
          docs.push({
            id: key.replace(`${collectionPath}/`, ''),
            data: () => value,
          });
        }
      }
      return { empty: docs.length === 0, docs };
    },
  });

  const mockAdminDbInstance = {
    collection: createCollectionRef,
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (docRef: any, data: any, options?: any) => {
          ops.push(async () => {
            await docRef.set(data, options);
          });
        },
        update: (docRef: any, data: any) => {
          ops.push(async () => {
            await docRef.update(data);
          });
        },
        commit: async () => {
          for (const op of ops) {
            await op();
          }
        },
      };
    },
  };

  return {
    PersistenceError,
    getFirebaseAdminProjectId: () => process.env.FIREBASE_PROJECT_ID || 'test-e2e-project',
    getAdminApp: () => ({ name: '[DEFAULT]' }),
    getAdminFirestore: () => mockAdminDbInstance,
    getAdminAuth: () => ({}),
  };
});

// Mock server-side auth guard
vi.mock('./auth-guard', () => ({
  resolveServerTenant: async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return {
      userId: 'test_user_merchant_1',
      tenantId: 'tenant_merchant_1',
      email: 'merchant@example.com',
    };
  },
}));

describe('Complete Real End-to-End Test (2026-07)', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const shop = 'superstore.myshopify.com';
  const tenantId = 'tenant_merchant_1';
  const secret = 'prod_client_secret_test_xyz';

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockDb.clear();
    process.env.FIREBASE_PROJECT_ID = 'test-e2e-project';
    process.env.SHOPIFY_CLIENT_ID = 'prod_client_id_123';
    process.env.SHOPIFY_CLIENT_SECRET = secret;
    process.env.SHOPIFY_API_VERSION = '2026-07';
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = '12345678901234567890123456789012';

    // Seed active merchant connection in Firestore
    const conn: ShopifyConnectionRecord = {
      id: `conn_${tenantId}_${shop}`,
      tenantId,
      shopDomain: shop,
      encryptedAccessToken: encryptShopifyToken('shpat_real_active_token_123'),
      encryptedRefreshToken: encryptShopifyToken('shprf_active_refresh_token_123'),
      accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 864000000).toISOString(),
      lastTokenRefreshAt: new Date().toISOString(),
      status: 'ACTIVE',
      requestedScopes: ['read_orders', 'write_orders', 'read_inventory', 'write_inventory', 'read_returns'],
      grantedScopes: ['read_orders', 'write_orders', 'read_inventory', 'write_inventory', 'read_returns'],
      missingScopes: [],
      storeName: 'Super Store',
      currency: 'USD',
      primaryLocationId: 'loc_mumbai_01',
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveShopifyConnection(conn);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function createSignedWebhookRequest(topic: string, eventId: string, payload: any): NextRequest {
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

    return new NextRequest('http://localhost:9002/api/shopify/webhooks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-shopify-topic': topic,
        'x-shopify-shop-domain': shop,
        'x-shopify-webhook-id': eventId,
        'x-shopify-hmac-sha256': hmac,
      },
      body: rawBody,
    });
  }

  // -------------------------------------------------------------
  // E2E Test 1: Shopify -> AnalyzeUp Order
  // -------------------------------------------------------------
  it('Flow 1: Ingests incoming Shopify customer sales order into sales_orders', async () => {
    const orderPayload = {
      id: 8881001,
      name: '#1001',
      financial_status: 'paid',
      fulfillment_status: 'unfulfilled',
      currency: 'USD',
      total_price: '199.98',
      customer: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
      line_items: [
        {
          id: 111,
          product_id: 222,
          variant_id: 333,
          title: 'Premium Running Shoes',
          sku: 'RUN-SHOE-01',
          quantity: 2,
          price: '99.99',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const req = createSignedWebhookRequest('orders/create', 'evt_order_1001', orderPayload);
    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.processed).toBe(true);

    // Verify record in sales_orders
    const savedOrder = mockDb.get(`users/${tenantId}/sales_orders/order_8881001`);
    expect(savedOrder).toBeDefined();
    expect(savedOrder.shopifyOrderId).toBe('8881001');
    expect(savedOrder.orderNumber).toBe('#1001');
    expect(savedOrder.customerName).toBe('Jane Doe');
    expect(savedOrder.totalPrice).toBe(199.98);

    // Verify webhook idempotency record saved
    const dedupRecord = mockDb.get(`shopify_processed_webhooks/${shop}_evt_order_1001`);
    expect(dedupRecord).toBeDefined();
    expect(dedupRecord.status).toBe('PROCESSED');
  });

  // -------------------------------------------------------------
  // E2E Test 2: Shopify -> AnalyzeUp Refund
  // -------------------------------------------------------------
  it('Flow 2: Ingests incoming Shopify refund into refunds with financial adjustments', async () => {
    const refundPayload = {
      id: 7772001,
      order_id: 8881001,
      created_at: new Date().toISOString(),
      transactions: [
        { id: 9991, amount: '99.99', currency: 'USD', kind: 'refund', status: 'success', gateway: 'shopify_payments' },
      ],
      refund_line_items: [
        {
          id: 444,
          quantity: 1,
          subtotal: 99.99,
          total_tax: 0,
          line_item: { id: 111, title: 'Premium Running Shoes', sku: 'RUN-SHOE-01', product_id: 222, variant_id: 333 },
        },
      ],
    };

    const req = createSignedWebhookRequest('refunds/create', 'evt_refund_2001', refundPayload);
    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.processed).toBe(true);

    // Verify record in refunds
    const savedRefund = mockDb.get(`users/${tenantId}/refunds/ref_8881001_7772001`);
    expect(savedRefund).toBeDefined();
    expect(savedRefund.shopifyRefundId).toBe('7772001');
    expect(savedRefund.amount).toBe(99.99);

    // Verify negative cashflow adjustment transaction generated
    const savedTx = mockDb.get(`users/${tenantId}/transactions/tx_refund_8881001_7772001`);
    expect(savedTx).toBeDefined();
    expect(savedTx.totalRevenue).toBe(-99.99);
    expect(savedTx.status).toBe('Refunded');
  });

  // -------------------------------------------------------------
  // E2E Test 3: Shopify -> AnalyzeUp Return
  // -------------------------------------------------------------
  it('Flow 3: Ingests full return lifecycle event into returns model', async () => {
    const returnPayload = {
      id: 6663001,
      order_id: 8881001,
      status: 'APPROVED',
      created_at: new Date().toISOString(),
      return_line_items: [
        {
          id: 555,
          quantity: 1,
          return_reason: 'SIZE_TOO_SMALL',
          return_reason_note: 'Customer ordered size 9, needs size 10',
          fulfillment_line_item: {
            line_item: { id: 111, title: 'Premium Running Shoes', sku: 'RUN-SHOE-01', price: '99.99' },
          },
        },
      ],
    };

    const req = createSignedWebhookRequest('returns/approve', 'evt_return_3001', returnPayload);
    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.processed).toBe(true);

    // Verify record in returns
    const savedReturn = mockDb.get(`users/${tenantId}/returns/ret_8881001_6663001`);
    expect(savedReturn).toBeDefined();
    expect(savedReturn.shopifyReturnId).toBe('6663001');
    expect(savedReturn.status).toBe('APPROVED');
    expect(savedReturn.returnItems[0].returnReason).toBe('SIZE_TOO_SMALL');
  });

  // -------------------------------------------------------------
  // E2E Test 4: Shopify -> AnalyzeUp Multi-Location Inventory
  // -------------------------------------------------------------
  it('Flow 4: Ingests inventory update webhook and updates location stock without loop echo', async () => {
    const inventoryPayload = {
      inventory_item_id: 444555,
      location_id: 101,
      available: 42,
      updated_at: new Date().toISOString(),
    };

    const req = createSignedWebhookRequest('inventory_levels/update', 'evt_inv_4001', inventoryPayload);
    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.processed).toBe(true);

    // Verify multi-location inventory record updated
    const savedInv = mockDb.get(`users/${tenantId}/inventory/444555_101`);
    expect(savedInv).toBeDefined();
    expect(savedInv.availableQuantity).toBe(42);
    expect(savedInv.inventoryItemId).toBe('444555');
    expect(savedInv.locationId).toBe('101');
  });

  // -------------------------------------------------------------
  // E2E Test 5: AnalyzeUp PO -> Shopify Inventory Adjustment
  // -------------------------------------------------------------
  it('Flow 5: Dispatches inventory adjustment from AnalyzeUp PO receiving to Shopify Admin API with 2026-07 idempotency', async () => {
    // Mock Shopify GraphQL inventoryAdjustQuantities response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          inventoryAdjustQuantities: {
            userErrors: [],
            inventoryAdjustmentGroup: {
              changes: [{ quantityAfterChange: 52 }],
            },
          },
        },
      }),
    } as any);

    const req = new NextRequest('http://localhost:9002/api/shopify/inventory/adjust', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer mock_firebase_token',
      },
      body: JSON.stringify({
        shop,
        inventoryItemId: '444555',
        locationId: '101',
        delta: 10,
        reason: 'received_purchase_order',
        purchaseOrderId: 'po_supplier_99',
        receivingEventId: 'rcv_po_99_event_1',
      }),
    });

    const res = await handleInventoryAdjust(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.quantityAfterChange).toBe(52);

    // Verify Shopify GraphQL was called with 2026-07 endpoint and @idempotent directive
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/api/2026-07/graphql.json'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'rcv_po_99_event_1',
        }),
        body: expect.stringContaining('@idempotent(key: $idempotencyKey)'),
      })
    );

    // Verify local location inventory was updated
    const savedInv = mockDb.get(`users/${tenantId}/inventory/444555_101`);
    expect(savedInv).toBeDefined();
    expect(savedInv.available).toBe(52);
  });

  // -------------------------------------------------------------
  // E2E Test 6: AnalyzeUp Sales Order -> Shopify Order Creation
  // -------------------------------------------------------------
  it('Flow 6: Creates real Shopify sales order via GraphQL orderCreate and saves Shopify GID in AnalyzeUp', async () => {
    // Mock Shopify GraphQL orderCreate response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          orderCreate: {
            userErrors: [],
            order: {
              id: 'gid://shopify/Order/8882002',
              name: '#1002',
              totalPriceSet: {
                shopMoney: {
                  amount: '149.99',
                  currencyCode: 'USD',
                },
              },
            },
          },
        },
      }),
    } as any);

    const req = new NextRequest('http://localhost:9002/api/shopify/orders/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer mock_firebase_token',
      },
      body: JSON.stringify({
        shop,
        idempotencyKey: 'idem_sales_order_1002',
        orderInput: {
          email: 'customer2@example.com',
          totalPrice: 149.99,
          lineItems: [
            {
              title: 'Trail Running Shoes',
              quantity: 1,
              price: 149.99,
              variantId: 'gid://shopify/ProductVariant/555',
            },
          ],
        },
      }),
    });

    const res = await handleOrderCreate(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.shopifyOrderId).toBe('8882002');
    expect(body.shopifyOrderGid).toBe('gid://shopify/Order/8882002');

    // Verify Shopify GraphQL was called with 2026-07 endpoint and @idempotent directive
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/api/2026-07/graphql.json'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'idem_sales_order_1002',
        }),
        body: expect.stringContaining('@idempotent(key: $idempotencyKey)'),
      })
    );

    // Verify order was persisted in sales_orders (NOT purchase_orders)
    const savedOrder = mockDb.get(`users/${tenantId}/sales_orders/8882002`);
    expect(savedOrder).toBeDefined();
    expect(savedOrder.shopifyOrderId).toBe('8882002');
    expect(savedOrder.orderNumber).toBe('#1002');
    expect(savedOrder.totalPrice).toBe(149.99);
  });

  // -------------------------------------------------------------
  // E2E Test 7: Real-time stock decrement & sale on incoming order
  // -------------------------------------------------------------
  it('Flow 7: Decrements product stock and records sale when orders/create webhook arrives', async () => {
    const prodDocId = 'shopify_999_888';
    mockDb.set(`users/${tenantId}/products/${prodDocId}`, {
      id: prodDocId,
      name: 'Ultra Boost Shoes',
      sku: 'BOOST-888',
      stock: 50,
      price: 180,
      shopifyProductId: '999',
      shopifyVariantId: '888',
    });

    const orderPayload = {
      id: 9999001,
      name: '#1003',
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
      currency: 'USD',
      total_price: '540.00',
      customer: { first_name: 'Alex', last_name: 'Ray', email: 'alex@example.com' },
      line_items: [
        {
          id: 777,
          product_id: 999,
          variant_id: 888,
          title: 'Ultra Boost Shoes',
          sku: 'BOOST-888',
          quantity: 3,
          price: '180.00',
        },
      ],
      created_at: new Date().toISOString(),
    };

    const req = createSignedWebhookRequest('orders/create', 'evt_order_1003', orderPayload);
    const res = await handleWebhook(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);

    // Verify stock was decremented from 50 -> 47 in real time
    const updatedProd = mockDb.get(`users/${tenantId}/products/${prodDocId}`);
    expect(updatedProd).toBeDefined();
    expect(updatedProd.stock).toBe(47);

    // Verify transaction created
    const savedTx = mockDb.get(`users/${tenantId}/transactions/tx_shopify_9999001_777`);
    expect(savedTx).toBeDefined();
    expect(savedTx.totalRevenue).toBe(540);

    // Verify profile updated with lastWebhookEvent
    const profile = mockDb.get(`users/${tenantId}/settings/business_profile`);
    expect(profile).toBeDefined();
    expect(profile.lastWebhookEvent).toBe('orders/create');
  });
});
