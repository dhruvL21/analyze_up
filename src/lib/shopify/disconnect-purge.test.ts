import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveShopifyConnection,
  getShopifyConnection,
  markShopifyDisconnected,
  markShopifyUninstalled,
} from './connection-store';
import { encryptShopifyToken } from './crypto';
import type { ShopifyConnectionRecord } from './types';

// Mock Firebase Admin SDK Store
const mockAdminStore = new Map<string, any>();

vi.mock('@/lib/firebase/admin', () => {
  const createDocRef = (collectionPath: string, docId: string) => {
    const fullPath = `${collectionPath}/${docId}`;
    return {
      id: docId,
      path: fullPath,
      get: async () => {
        const data = mockAdminStore.get(fullPath);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
      set: async (data: any, options?: any) => {
        if (options?.merge && mockAdminStore.has(fullPath)) {
          const existing = mockAdminStore.get(fullPath);
          mockAdminStore.set(fullPath, { ...existing, ...data });
        } else {
          mockAdminStore.set(fullPath, data);
        }
      },
      delete: async () => {
        mockAdminStore.delete(fullPath);
      },
    };
  };

  const createCollectionRef = (collectionPath: string) => ({
    doc: (docId: string) => {
      return {
        ...createDocRef(collectionPath, docId),
        collection: (subColl: string) => createCollectionRef(`${collectionPath}/${docId}/${subColl}`),
      };
    },
    where: (field: string, _op: string, val: any) => ({
      get: async () => {
        const docs: any[] = [];
        for (const [key, value] of mockAdminStore.entries()) {
          if (key.startsWith(`${collectionPath}/`) && value && value[field] === val) {
            docs.push({
              id: key.replace(`${collectionPath}/`, ''),
              ref: createDocRef(collectionPath, key.replace(`${collectionPath}/`, '')),
              data: () => value,
            });
          }
        }
        return { empty: docs.length === 0, docs, size: docs.length };
      },
    }),
    get: async () => {
      const docs: any[] = [];
      for (const [key, value] of mockAdminStore.entries()) {
        if (key.startsWith(`${collectionPath}/`)) {
          docs.push({
            id: key.replace(`${collectionPath}/`, ''),
            ref: createDocRef(collectionPath, key.replace(`${collectionPath}/`, '')),
            data: () => value,
          });
        }
      }
      return { empty: docs.length === 0, docs, size: docs.length };
    },
  });

  const mockDb = {
    collection: createCollectionRef,
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, data: any, options?: any) => {
          ops.push(async () => {
            await ref.set(data, options);
          });
        },
        delete: (ref: any) => {
          ops.push(async () => {
            await ref.delete();
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
    hasAdminCredentials: () => true,
    getAdminFirestore: () => mockDb,
    getAdminApp: () => ({ name: '[DEFAULT]' }),
    getAdminAuth: () => ({}),
  };
});

describe('Shopify Disconnect & Data Purge Suite', () => {
  const shop = 'test-merchant.myshopify.com';
  const tenantId = 'tenant_user_123';

  beforeEach(() => {
    mockAdminStore.clear();
  });

  it('marks connection DISCONNECTED, wipes credentials, and purges Shopify records on disconnect', async () => {
    // 1. Establish an active connection
    const record: ShopifyConnectionRecord = {
      id: `conn_${tenantId}_${shop}`,
      tenantId,
      shopDomain: shop,
      encryptedAccessToken: encryptShopifyToken('shpat_active_12345'),
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastTokenRefreshAt: null,
      status: 'ACTIVE',
      requestedScopes: ['read_products'],
      grantedScopes: ['read_products'],
      missingScopes: [],
      storeName: 'Test Merchant',
      currency: 'INR',
      primaryLocationId: null,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveShopifyConnection(record);

    // 2. Populate store data: Shopify records + manual record
    mockAdminStore.set(`users/${tenantId}/products/shopify_prod_1`, {
      id: 'shopify_prod_1',
      name: 'Shopify T-Shirt',
      source: 'SHOPIFY',
      price: 999,
    });
    mockAdminStore.set(`users/${tenantId}/products/manual_prod_1`, {
      id: 'manual_prod_1',
      name: 'Manual Coffee Mug',
      source: 'MANUAL',
      price: 299,
    });
    mockAdminStore.set(`users/${tenantId}/transactions/tx_shopify_ord_1`, {
      id: 'tx_shopify_ord_1',
      productName: 'Shopify T-Shirt',
      source: 'SHOPIFY',
      paymentMethod: 'Shopify Payments',
    });
    mockAdminStore.set(`users/${tenantId}/transactions/tx_manual_1`, {
      id: 'tx_manual_1',
      productName: 'Manual Coffee Mug',
      source: 'MANUAL',
      paymentMethod: 'Cash',
    });
    mockAdminStore.set(`users/${tenantId}/returns/ret_shopify_1`, {
      id: 'ret_shopify_1',
      source: 'SHOPIFY',
      reason: 'Defective',
    });
    mockAdminStore.set(`users/${tenantId}/sales_orders/order_101`, {
      id: 'order_101',
      source: 'SHOPIFY',
    });
    mockAdminStore.set(`users/${tenantId}/integrations/shopify`, {
      connectionStatus: 'Connected',
      accessToken: 'shpat_active_12345',
    });

    mockAdminStore.set(`users/${tenantId}/products/drive_prod_1`, {
      id: 'drive_prod_1',
      name: 'Google Drive Spreadsheet Product',
      source: 'GOOGLE_DRIVE',
      importSource: 'drive',
      price: 1499,
    });
    mockAdminStore.set(`users/${tenantId}/transactions/tx_drive_1`, {
      id: 'tx_drive_1',
      productName: 'Google Drive Spreadsheet Product',
      source: 'GOOGLE_DRIVE',
      importSource: 'drive',
    });
    mockAdminStore.set(`users/${tenantId}/integrations/google-drive`, {
      email: 'merchant@gmail.com',
      selectedFolderId: 'folder_123',
    });
    mockAdminStore.set(`users/${tenantId}/google_drive_files/file_1`, {
      name: 'Inventory_2026.xlsx',
      id: 'file_1',
    });

    // 3. Disconnect with purgeData: true
    await markShopifyDisconnected(shop, tenantId, true);

    // 4. Verify connection status and stripped credentials
    const updatedConn = await getShopifyConnection(shop);
    expect(updatedConn?.status).toBe('DISCONNECTED');
    expect(updatedConn?.encryptedAccessToken).toBeNull();

    // 5. Verify Shopify records are completely purged
    expect(mockAdminStore.has(`users/${tenantId}/products/shopify_prod_1`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/transactions/tx_shopify_ord_1`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/returns/ret_shopify_1`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/sales_orders/order_101`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/integrations/shopify`)).toBe(false);

    // 6. Verify non-Shopify manual and Google Drive records are PRESERVED
    expect(mockAdminStore.has(`users/${tenantId}/products/manual_prod_1`)).toBe(true);
    expect(mockAdminStore.has(`users/${tenantId}/transactions/tx_manual_1`)).toBe(true);
    expect(mockAdminStore.has(`users/${tenantId}/products/drive_prod_1`)).toBe(true);
    expect(mockAdminStore.has(`users/${tenantId}/transactions/tx_drive_1`)).toBe(true);
    expect(mockAdminStore.has(`users/${tenantId}/integrations/google-drive`)).toBe(true);
    expect(mockAdminStore.has(`users/${tenantId}/google_drive_files/file_1`)).toBe(true);
  });

  it('marks connection UNINSTALLED and purges Shopify records when uninstalled', async () => {
    const record: ShopifyConnectionRecord = {
      id: `conn_${tenantId}_${shop}`,
      tenantId,
      shopDomain: shop,
      encryptedAccessToken: encryptShopifyToken('shpat_active_12345'),
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastTokenRefreshAt: null,
      status: 'ACTIVE',
      requestedScopes: ['read_products'],
      grantedScopes: ['read_products'],
      missingScopes: [],
      storeName: 'Test Merchant',
      currency: 'USD',
      primaryLocationId: null,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveShopifyConnection(record);

    mockAdminStore.set(`users/${tenantId}/products/shopify_prod_2`, {
      id: 'shopify_prod_2',
      source: 'SHOPIFY',
    });

    await markShopifyUninstalled(shop, true);

    const updatedConn = await getShopifyConnection(shop);
    expect(updatedConn?.status).toBe('UNINSTALLED');
    expect(updatedConn?.encryptedAccessToken).toBeNull();
    expect(mockAdminStore.has(`users/${tenantId}/products/shopify_prod_2`)).toBe(false);
  });

  it('purges transactions with auto-generated random doc IDs, custom payment methods (UPI/COD), and resets analytics summary', async () => {
    // Set active connection
    const record: ShopifyConnectionRecord = {
      id: `conn_${tenantId}_${shop}`,
      tenantId,
      shopDomain: shop,
      encryptedAccessToken: encryptShopifyToken('shpat_active_test'),
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastTokenRefreshAt: null,
      status: 'ACTIVE',
      requestedScopes: ['read_products'],
      grantedScopes: ['read_products'],
      missingScopes: [],
      storeName: 'Test Merchant',
      currency: 'INR',
      primaryLocationId: null,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveShopifyConnection(record);

    // Products
    mockAdminStore.set(`users/${tenantId}/products/shopify_9876543210_123456`, {
      id: 'shopify_9876543210_123456',
      shopifyProductId: '9876543210',
      shopifyVariantId: '123456',
      sku: 'SNK-ELV12-07',
      name: 'Elevate Running Shoes',
      source: 'SHOPIFY',
      stock: 0,
      price: 18320,
    });

    // 2 transactions with auto-generated Firestore IDs (e.g. random hash), custom payment methods, matching SKU
    mockAdminStore.set(`users/${tenantId}/transactions/random_auto_id_999a`, {
      id: 'tx_shopify_order_1001_item_1',
      productId: '9876543210', // Raw Shopify numeric ID
      sku: 'SNK-ELV12-07',
      productName: 'Elevate Running Shoes',
      source: 'SHOPIFY',
      paymentMethod: 'UPI',
      totalRevenue: 18320,
      type: 'Sale',
    });
    mockAdminStore.set(`users/${tenantId}/transactions/random_auto_id_999b`, {
      id: 'tx_shopify_order_1002_item_1',
      productId: '9876543210',
      sku: 'SNK-ELV12-07',
      productName: 'Elevate Running Shoes',
      source: 'SHOPIFY',
      paymentMethod: 'Cash on Delivery',
      totalRevenue: 18320,
      type: 'Sale',
    });

    // Existing analytics summary with 41 transactions
    mockAdminStore.set(`users/${tenantId}/analytics/summary`, {
      totalProducts: 14,
      totalTransactions: 41,
      totalRevenue: 751185,
      grossProfit: 300477,
      inventoryValuation: 0,
      healthScore: 85,
    });

    // Disconnect Shopify
    await markShopifyDisconnected(shop, tenantId, true);

    // Verify products and transactions with random auto-IDs are purged
    expect(mockAdminStore.has(`users/${tenantId}/products/shopify_9876543210_123456`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/transactions/random_auto_id_999a`)).toBe(false);
    expect(mockAdminStore.has(`users/${tenantId}/transactions/random_auto_id_999b`)).toBe(false);

    // Verify analytics summary was reset to clean zero-state
    const summary = mockAdminStore.get(`users/${tenantId}/analytics/summary`);
    expect(summary).toBeDefined();
    expect(summary?.totalTransactions).toBe(0);
    expect(summary?.totalRevenue).toBe(0);
  });
});

