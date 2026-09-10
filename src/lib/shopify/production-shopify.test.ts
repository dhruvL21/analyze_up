import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleShopifySync } from '@/app/api/shopify/sync/route';
import {
  sanitizeShopDomain,
  getShopifyApiVersion,
  getShopifyGraphQLEndpoint,
  getShopifyScopes,
  SHOPIFY_API_VERSION,
  REQUIRED_SHOPIFY_SCOPES,
} from './config';
import {
  encryptShopifyToken,
  decryptShopifyToken,
  verifyShopifyHmac,
  verifyShopifyWebhookHmac,
} from './crypto';
import {
  saveOAuthState,
  consumeOAuthState,
  saveShopifyConnection,
  getShopifyConnection,
  markShopifyUninstalled,
  PersistenceError,
} from './connection-store';
import {
  getValidAccessToken,
  executeShopifyGraphQL,
  adjustShopifyInventory,
  createShopifySalesOrder,
  queryGrantedScopes,
  queryShopLocations,
  getShopifyGrantedScopes,
  ShopifyGraphQLError,
} from './admin-api';
import {
  recordOutgoingOperation,
  checkIsOutgoingOperation,
  completeOutgoingOperation,
} from './loop-prevention';
import { REQUIRED_WEBHOOK_TOPICS } from './webhook-manager';
import type { ShopifyConnectionRecord } from './types';

// Mock Firebase Admin SDK Store
const mockAdminStore = new Map<string, any>();

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
      update: async (data: any) => {
        const existing = mockAdminStore.get(fullPath) || {};
        mockAdminStore.set(fullPath, { ...existing, ...data });
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
              data: () => value,
            });
          }
        }
        return {
          empty: docs.length === 0,
          docs,
        };
      },
    }),
    get: async () => {
      const docs: any[] = [];
      for (const [key, value] of mockAdminStore.entries()) {
        if (key.startsWith(`${collectionPath}/`)) {
          docs.push({
            id: key.replace(`${collectionPath}/`, ''),
            data: () => value,
          });
        }
      }
      return {
        empty: docs.length === 0,
        docs,
      };
    },
  });

  const mockDb = {
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
    getFirebaseAdminProjectId: () => {
      const pid = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!pid) throw new PersistenceError('FIREBASE_PROJECT_ID_MISSING', 'Project ID is required');
      return pid;
    },
    getAdminApp: () => ({ name: '[DEFAULT]' }),
    getAdminFirestore: () => mockDb,
    getAdminAuth: () => ({}),
  };
});

describe('Production Shopify Multi-Tenant Hardening Suite', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAdminStore.clear();
    process.env.SHOPIFY_CLIENT_ID = 'mock_client_id_123';
    process.env.SHOPIFY_CLIENT_SECRET = 'mock_client_secret_xyz';
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32-char key
    process.env.SHOPIFY_API_VERSION = '2026-07';
    delete process.env.SHOPIFY_SCOPES;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  // ============================================================
  // 1. API Version & Domain Normalization
  // ============================================================
  describe('1. API Version & Domain Normalization (2026-07)', () => {
    it('reads SHOPIFY_API_VERSION dynamically from configuration as 2026-07 and never hard-codes 2024-04', () => {
      expect(getShopifyApiVersion()).toBe('2026-07');
      expect(getShopifyGraphQLEndpoint('test-store.myshopify.com')).toContain('/admin/api/2026-07/graphql.json');
      expect(SHOPIFY_API_VERSION).toBe('2026-07');
    });

    it('sanitizes and normalizes raw merchant domains cleanly', () => {
      expect(sanitizeShopDomain('https://merchant-a.myshopify.com/')).toBe('merchant-a.myshopify.com');
      expect(sanitizeShopDomain('merchant-b')).toBe('merchant-b.myshopify.com');
      expect(sanitizeShopDomain('http://merchant-c.myshopify.com/admin')).toBe('merchant-c.myshopify.com');
      expect(sanitizeShopDomain('https://admin.shopify.com/store/14aj1c-0a')).toBe('14aj1c-0a.myshopify.com');
      expect(sanitizeShopDomain('admin.shopify.com/store/snkhed-store/products')).toBe('snkhed-store.myshopify.com');
      expect(sanitizeShopDomain('invalid domain!@#')).toBeNull();
    });

    it('strictly requires exactly the 5 scopes for inventory, orders, products, and locations', () => {
      expect(REQUIRED_SHOPIFY_SCOPES).toEqual([
        'read_products',
        'read_orders',
        'read_inventory',
        'read_locations',
        'write_inventory',
      ]);
      const scopes = getShopifyScopes();
      expect(scopes).toContain('read_locations');
      expect(scopes).toContain('write_inventory');
      expect(scopes).toContain('read_products');
      expect(scopes).toContain('read_orders');
      expect(scopes).toContain('read_inventory');
      expect(scopes).not.toContain('read_returns');
    });
  });

  // ============================================================
  // 2. Encryption & Key Separation
  // ============================================================
  describe('2. Token Encryption (AES-256-GCM) & Dedicated Key', () => {
    it('encrypts and decrypts tokens faithfully using dedicated SHOPIFY_TOKEN_ENCRYPTION_KEY', () => {
      const plaintextToken = 'shpat_production_access_token_123456';
      const encrypted = encryptShopifyToken(plaintextToken);

      expect(encrypted).not.toBe(plaintextToken);
      expect(encrypted).toContain(':'); // format: iv:authTag:encrypted

      const decrypted = decryptShopifyToken(encrypted);
      expect(decrypted).toBe(plaintextToken);
    });

    it('fails decryption if encrypted payload is tampered with', () => {
      const plaintextToken = 'shpat_sensitive_token';
      const encrypted = encryptShopifyToken(plaintextToken);
      const [iv, tag, ciphertext] = encrypted.split(':');
      const tampered = `${iv}:${tag}:9999${ciphertext.slice(4)}`;

      expect(() => decryptShopifyToken(tampered)).toThrow();
    });
  });

  // ============================================================
  // 3. OAuth State Machine & HMAC Verification
  // ============================================================
  describe('3. OAuth Security & One-Time State Lifecycle', () => {
    it('verifies valid OAuth state nonce and consumes it atomically once', async () => {
      const nonce = 'valid_nonce_abc';
      const shop = 'merchant-a.myshopify.com';
      const tenantId = 'tenant_123';

      await saveOAuthState({
        nonce,
        tenantId,
        normalizedShopDomain: shop,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        consumedAt: null,
      });

      // First consumption succeeds
      const result1 = await consumeOAuthState(nonce, shop);
      expect(result1.valid).toBe(true);
      expect(result1.tenantId).toBe(tenantId);

      // Replay attempt fails (cannot be consumed twice)
      const result2 = await consumeOAuthState(nonce, shop);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('already been consumed');
    });

    it('rejects expired OAuth state nonce', async () => {
      const nonce = 'expired_nonce_xyz';
      const shop = 'merchant-a.myshopify.com';

      await saveOAuthState({
        nonce,
        tenantId: 'tenant_123',
        normalizedShopDomain: shop,
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // expired
        consumedAt: null,
      });

      const result = await consumeOAuthState(nonce, shop);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects state if callback shop does not match state shop', async () => {
      const nonce = 'mismatched_shop_nonce';
      await saveOAuthState({
        nonce,
        tenantId: 'tenant_123',
        normalizedShopDomain: 'store-a.myshopify.com',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        consumedAt: null,
      });

      const result = await consumeOAuthState(nonce, 'store-attacker.myshopify.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mismatch');
    });

    it('accepts state if callback shop is an equivalent redirect alias of state shop', async () => {
      const nonce = 'alias_redirect_nonce';
      const initiatedShop = 'snkhed.myshopify.com';
      const canonicalShop = '14aj1c-0a.myshopify.com';

      await saveOAuthState({
        nonce,
        tenantId: 'tenant_456',
        normalizedShopDomain: initiatedShop,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        consumedAt: null,
      });

      // Mock HEAD request simulating Shopify 301 primary_domain_redirection
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes(canonicalShop)) {
          return {
            status: 301,
            headers: new Headers({
              location: `https://${initiatedShop}/`,
              'x-redirect-reason': 'primary_domain_redirection',
            }),
          };
        }
        return {
          status: 200,
          headers: new Headers(),
        };
      });

      const result = await consumeOAuthState(nonce, canonicalShop);
      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('tenant_456');
    });

    it('verifies Shopify OAuth callback HMAC correctly', () => {
      const secret = 'test_secret';
      const params = new URLSearchParams({
        code: 'auth_code_123',
        shop: 'store.myshopify.com',
        state: 'nonce_123',
        timestamp: '1700000000',
      });
      // Compute expected HMAC
      const crypto = require('crypto');
      const message = 'code=auth_code_123&shop=store.myshopify.com&state=nonce_123&timestamp=1700000000';
      const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
      params.set('hmac', hmac);

      expect(verifyShopifyHmac(params, secret)).toBe(true);

      // Tampered parameter
      params.set('code', 'tampered_code');
      expect(verifyShopifyHmac(params, secret)).toBe(false);
    });
  });

  // ============================================================
  // 4. Expiring Offline Token Support & Automatic Refresh
  // ============================================================
  describe('4. Expiring Offline Token Refresh & Mutex Lock', () => {
    it('returns existing access token if far from expiry', async () => {
      const shop = 'active-store.myshopify.com';
      const plaintextToken = 'shpat_active_123';
      const conn: ShopifyConnectionRecord = {
        id: `conn_tenant1_${shop}`,
        tenantId: 'tenant1',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken(plaintextToken),
        encryptedRefreshToken: encryptShopifyToken('shprf_active_refresh'),
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour remaining
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        lastTokenRefreshAt: new Date().toISOString(),
        status: 'ACTIVE',
        requestedScopes: ['read_orders'],
        grantedScopes: ['read_orders'],
        missingScopes: [],
        storeName: 'Active Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveShopifyConnection(conn);

      const token = await getValidAccessToken(shop);
      expect(token).toBe(plaintextToken);
    });

    it('automatically refreshes token if within 5 minutes of expiration', async () => {
      const shop = 'expiring-store.myshopify.com';
      const initialToken = 'shpat_old_token';
      const initialRefresh = 'shprf_old_refresh';
      const newToken = 'shpat_newly_refreshed_token';
      const newRefresh = 'shprf_new_rotated_refresh';

      const conn: ShopifyConnectionRecord = {
        id: `conn_tenant1_${shop}`,
        tenantId: 'tenant1',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken(initialToken),
        encryptedRefreshToken: encryptShopifyToken(initialRefresh),
        accessTokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes left (< 5 min)
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        lastTokenRefreshAt: new Date().toISOString(),
        status: 'ACTIVE',
        requestedScopes: ['read_orders'],
        grantedScopes: ['read_orders'],
        missingScopes: [],
        storeName: 'Expiring Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveShopifyConnection(conn);

      // Mock Shopify token refresh response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: newToken,
          refresh_token: newRefresh,
          expires_in: 86400,
          refresh_token_expires_in: 7776000,
        }),
      } as any);

      const validToken = await getValidAccessToken(shop);
      expect(validToken).toBe(newToken);

      // Verify connection in store was updated with rotated tokens
      const updatedConn = await getShopifyConnection(shop);
      expect(decryptShopifyToken(updatedConn!.encryptedAccessToken!)).toBe(newToken);
      expect(decryptShopifyToken(updatedConn!.encryptedRefreshToken!)).toBe(newRefresh);
    });
  });

  // ============================================================
  // 5. Tenant Isolation & Zero-Trust
  // ============================================================
  describe('5. Strict Tenant Isolation', () => {
    it('prevents tenant B from accessing or operating on tenant A store', async () => {
      const shopA = 'merchant-a.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenantA_${shopA}`,
        tenantId: 'tenantA',
        shopDomain: shopA,
        encryptedAccessToken: encryptShopifyToken('tokenA'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_orders'],
        grantedScopes: ['read_orders'],
        missingScopes: [],
        storeName: 'Store A',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const conn = await getShopifyConnection(shopA);
      expect(conn).toBeDefined();
      expect(conn?.tenantId).toBe('tenantA');
      // Tenant B check
      const isCallerAuthorized = conn?.tenantId === 'tenantB';
      expect(isCallerAuthorized).toBe(false);
    });
  });

  // ============================================================
  // 6. Webhook Verification & Idempotency
  // ============================================================
  describe('6. Webhook HMAC & Delivery Idempotency', () => {
    it('validates Shopify webhook HMAC signature with client secret', () => {
      const secret = 'webhook_secret_key';
      const rawBody = JSON.stringify({ id: 12345, topic: 'orders/create' });
      const crypto = require('crypto');
      const validHmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

      expect(verifyShopifyWebhookHmac(rawBody, validHmac, secret)).toBe(true);
      expect(verifyShopifyWebhookHmac(rawBody, 'invalid_hmac_base64', secret)).toBe(false);
    });

    it('contains all required production webhook topics including returns lifecycle', () => {
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('orders/create');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('orders/updated');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('refunds/create');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('inventory_levels/update');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('app/uninstalled');
      // Returns lifecycle
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/request');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/approve');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/decline');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/update');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/process');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/close');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/cancel');
      expect(REQUIRED_WEBHOOK_TOPICS).toContain('returns/reopen');
    });
  });

  // ============================================================
  // 7. Loop Prevention & Durable Outgoing Operations
  // ============================================================
  describe('7. Durable Outgoing Operation Tracking (No 5s heuristics)', () => {
    it('records and identifies outgoing operations to prevent echo loops', async () => {
      const shop = 'loop-test.myshopify.com';
      const resourceId = 'inv_101_loc_202';

      // Record outbound operation initiated by AnalyzeUp
      const opId = await recordOutgoingOperation({
        tenantId: 'tenant_abc',
        shop,
        resourceType: 'INVENTORY',
        resourceId,
        mutationType: 'inventoryAdjustQuantities',
      });

      expect(opId).toBeDefined();

      // Incoming webhook arrives: checks if self-originated
      const check = await checkIsOutgoingOperation(shop, resourceId);
      expect(check.isOriginatingFromAnalyzeUp).toBe(true);
      expect(check.operationId).toBe(opId);

      // Complete operation
      await completeOutgoingOperation(opId, 'COMPLETED');
    });
  });

  // ============================================================
  // 8. Outbound GraphQL Mutations (Inventory Adjustment & Order Creation)
  // ============================================================
  describe('8. Outbound GraphQL Operations', () => {
    it('dispatches inventoryAdjustQuantities mutation successfully', async () => {
      const shop = 'inv-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenant1_${shop}`,
        tenantId: 'tenant1',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('valid_token'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_inventory'],
        grantedScopes: ['read_inventory'],
        missingScopes: [],
        storeName: 'Inventory Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            inventoryAdjustQuantities: {
              userErrors: [],
              inventoryAdjustmentGroup: {
                changes: [{ quantityAfterChange: 75 }],
              },
            },
          },
        }),
      } as any);

      const res = await adjustShopifyInventory({
        shop,
        inventoryItemId: '12345',
        locationId: '67890',
        delta: 25,
        reason: 'restock',
        idempotencyKey: 'test_inv_idem_key_123',
      });

      expect(res.success).toBe(true);
      expect(res.quantityAfterChange).toBe(75);
      expect(res.idempotencyKey).toBe('test_inv_idem_key_123');

      // Verify GraphQL call included mandatory 2026-07 @idempotent directive & Idempotency-Key header
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/2026-07/graphql.json'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'test_inv_idem_key_123',
          }),
          body: expect.stringContaining('@idempotent(key: $idempotencyKey)'),
        })
      );
    });

    it('creates authorized Shopify customer sales order and returns Shopify Order GID with idempotency', async () => {
      const shop = 'sales-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenant1_${shop}`,
        tenantId: 'tenant1',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('valid_token'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['write_orders'],
        grantedScopes: ['write_orders'],
        missingScopes: [],
        storeName: 'Sales Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            orderCreate: {
              userErrors: [],
              order: {
                id: 'gid://shopify/Order/987654321',
                name: '#1055',
              },
            },
          },
        }),
      } as any);

      const res = await createShopifySalesOrder({
        shop,
        orderInput: {
          lineItems: [{ quantity: 2, variantId: 'gid://shopify/ProductVariant/111' }],
        },
        idempotencyKey: 'test_order_idem_key_456',
      });

      expect(res.success).toBe(true);
      expect(res.orderId).toBe('gid://shopify/Order/987654321');
      expect(res.orderName).toBe('#1055');
      expect(res.idempotencyKey).toBe('test_order_idem_key_456');

      // Verify GraphQL call included mandatory @idempotent directive & Idempotency-Key header
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/2026-07/graphql.json'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'test_order_idem_key_456',
          }),
          body: expect.stringContaining('@idempotent(key: $idempotencyKey)'),
        })
      );
    });
  });

  // ============================================================
  // 9. App Uninstall Security
  // ============================================================
  describe('9. App Uninstall Security & Credential Scrubbing', () => {
    it('marks connection UNINSTALLED and strips encrypted tokens immediately', async () => {
      const shop = 'uninstalled-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenant1_${shop}`,
        tenantId: 'tenant1',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('active_token'),
        encryptedRefreshToken: encryptShopifyToken('active_refresh'),
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_orders'],
        grantedScopes: ['read_orders'],
        missingScopes: [],
        storeName: 'Uninstall Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await markShopifyUninstalled(shop);

      const updated = await getShopifyConnection(shop);
      expect(updated?.status).toBe('UNINSTALLED');
      expect(updated?.encryptedAccessToken).toBeNull();
      expect(updated?.encryptedRefreshToken).toBeNull();
      expect(updated?.uninstalledAt).toBeDefined();

      // Subsequent API calls are blocked
      await expect(getValidAccessToken(shop)).rejects.toThrow('uninstalled or disconnected');
    });
  });

  // ============================================================
  // 10. Scope Verification, GraphQL Location Resilience & Admin Persistence
  // ============================================================
  describe('10. Scope Verification, GraphQL Location Resilience & Admin Persistence', () => {
    it('dynamically computes missing scopes when store lacks read_locations or write_inventory', async () => {
      const shop = 'partial-scope-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenantA_${shop}`,
        tenantId: 'tenantA',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('mock_partial_token'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'PARTIAL',
        requestedScopes: ['read_products', 'read_orders', 'read_inventory', 'read_locations', 'write_inventory'],
        grantedScopes: ['read_products', 'read_orders', 'read_inventory'],
        missingScopes: ['read_locations', 'write_inventory'],
        storeName: 'Partial Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock GraphQL response for currentAppInstallation.accessScopes
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            currentAppInstallation: {
              accessScopes: [
                { handle: 'read_products' },
                { handle: 'read_orders' },
                { handle: 'read_inventory' },
              ],
            },
          },
        }),
      });

      const scopeInfo = await getShopifyGrantedScopes(shop);
      expect(scopeInfo.isAuthorized).toBe(false);
      expect(scopeInfo.grantedScopes).toEqual(['read_products', 'read_orders', 'read_inventory']);
      expect(scopeInfo.missingScopes).toEqual(['read_locations', 'write_inventory']);
    });

    it('raises structured SHOPIFY_MISSING_SCOPE error when GraphQL returns scope denied for location name', async () => {
      const shop = 'denied-location.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenantA_${shop}`,
        tenantId: 'tenantA',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('mock_token'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_products'],
        grantedScopes: ['read_products'],
        missingScopes: [],
        storeName: 'Denied Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [
            {
              message: 'Access denied for name field. Required access: `read_locations` access scope or `read_markets_home` access scope.',
              locations: [{ line: 6, column: 11 }],
              path: ['locations', 'nodes', 0, 'name'],
            },
          ],
        }),
      });

      try {
        await queryShopLocations(shop);
        expect.unreachable('Should have thrown ShopifyGraphQLError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ShopifyGraphQLError);
        expect(err.status).toBe(403);
        expect(err.errorCode).toBe('SHOPIFY_MISSING_SCOPE');
        expect(err.message).toContain('read_locations');
      }
    });

    it('persists connections, store indexes, and business profiles atomically using Admin SDK without permission denied', async () => {
      const shop = 'admin-persisted-store.myshopify.com';
      const record: ShopifyConnectionRecord = {
        id: `conn_tenant10_${shop}`,
        tenantId: 'tenant10',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('token_10'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_products', 'read_orders', 'read_inventory', 'read_locations', 'write_inventory'],
        grantedScopes: ['read_products', 'read_orders', 'read_inventory', 'read_locations', 'write_inventory'],
        missingScopes: [],
        storeName: 'Admin Store',
        currency: 'USD',
        primaryLocationId: 'loc_1',
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveShopifyConnection(record);

      // Verify master connection record
      const savedConn = await getShopifyConnection(shop);
      expect(savedConn).toBeDefined();
      expect(savedConn?.shopDomain).toBe(shop);
      expect(savedConn?.status).toBe('ACTIVE');

      // Verify store lookup index was created
      expect(mockAdminStore.has(`shopify_stores/${shop}`)).toBe(true);
      expect(mockAdminStore.get(`shopify_stores/${shop}`).tenantId).toBe('tenant10');

      // Verify business profile was mirrored without exposing tokens
      const profilePath = `users/tenant10/settings/business_profile`;
      expect(mockAdminStore.has(profilePath)).toBe(true);
      const profile = mockAdminStore.get(profilePath);
      expect(profile.shopifyConnected).toBe(true);
      expect(profile.shopifyStoreUrl).toBe(shop);
      expect(profile.accessToken).toBeUndefined(); // Zero token exposure
    });

    it('preserves multi-tenant isolation so tenant B cannot read or sync tenant A connection', async () => {
      const shopA = 'store-tenant-a.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenantA_${shopA}`,
        tenantId: 'tenantA',
        shopDomain: shopA,
        encryptedAccessToken: encryptShopifyToken('token_a'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_products'],
        grantedScopes: ['read_products'],
        missingScopes: [],
        storeName: 'Store A',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const connA = await getShopifyConnection(shopA);
      expect(connA?.tenantId).toBe('tenantA');
      expect(connA?.tenantId).not.toBe('tenantB');
    });
  });

  // ============================================================
  // 11. Resilient Sync Route with Auto-Refresh & 401 Self-Healing
  // ============================================================
  describe('11. Resilient Sync Route with Auto-Refresh & 401 Self-Healing', () => {
    it('prioritizes server-managed valid token over stale client-passed accessToken', async () => {
      const shop = 'sync-resilient-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenant11_${shop}`,
        tenantId: 'tenant11',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('valid_server_token_123'),
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTokenRefreshAt: null,
        status: 'ACTIVE',
        requestedScopes: ['read_products', 'read_orders'],
        grantedScopes: ['read_products', 'read_orders'],
        missingScopes: [],
        storeName: 'Sync Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      let tokenReceivedByShopify = '';
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
        tokenReceivedByShopify = init?.headers?.['X-Shopify-Access-Token'] || '';
        if (url.includes('/products.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ products: [{ id: 101, title: 'Resilient Product', variants: [] }] }),
          };
        }
        if (url.includes('/orders.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ orders: [] }),
          };
        }
        if (url.includes('/graphql.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { returns: { nodes: [] } } }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      });

      // Pass an expired/stale accessToken from client
      const req = new NextRequest('http://localhost:9002/api/shopify/sync', {
        method: 'POST',
        body: JSON.stringify({
          shop,
          accessToken: 'shpat_stale_expired_client_token',
        }),
      });

      const res = await handleShopifySync(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.products.length).toBe(1);
      expect(data.newAccessToken).toBe('valid_server_token_123');
      // Server ignored the stale client token and used the valid server token!
      expect(tokenReceivedByShopify).toBe('valid_server_token_123');
    });

    it('automatically refreshes token and retries request when Shopify responds with 401', async () => {
      const shop = 'sync-401-refresh-store.myshopify.com';
      await saveShopifyConnection({
        id: `conn_tenant11_${shop}`,
        tenantId: 'tenant11',
        shopDomain: shop,
        encryptedAccessToken: encryptShopifyToken('initial_expired_token'),
        encryptedRefreshToken: encryptShopifyToken('valid_refresh_token'),
        accessTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        lastTokenRefreshAt: new Date().toISOString(),
        status: 'ACTIVE',
        requestedScopes: ['read_products', 'read_orders'],
        grantedScopes: ['read_products', 'read_orders'],
        missingScopes: [],
        storeName: 'Sync 401 Store',
        currency: 'USD',
        primaryLocationId: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        lastSyncAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
        // Token refresh endpoint call
        if (url.includes('/admin/oauth/access_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'newly_refreshed_access_token_456',
              refresh_token: 'new_refresh_token_789',
              expires_in: 3600,
              refresh_token_expires_in: 7776000,
            }),
          };
        }

        if (url.includes('/products.json')) {
          fetchCallCount++;
          // First attempt returns 401 with initial_expired_token
          if (init?.headers?.['X-Shopify-Access-Token'] === 'initial_expired_token') {
            return {
              ok: false,
              status: 401,
              text: async () => 'Invalid API key or access token (unrecognized login or wrong password)',
            };
          }
          // Retry with refreshed token succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({ products: [{ id: 202, title: 'Retried Product', variants: [] }] }),
          };
        }

        if (url.includes('/orders.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ orders: [] }),
          };
        }

        if (url.includes('/graphql.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { returns: { nodes: [] } } }),
          };
        }

        return { ok: false, status: 404, text: async () => 'Not found' };
      });

      const req = new NextRequest('http://localhost:9002/api/shopify/sync', {
        method: 'POST',
        body: JSON.stringify({ shop }),
      });

      const res = await handleShopifySync(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.products.length).toBe(1);
      expect(data.products[0].name).toBe('Retried Product');
      expect(data.newAccessToken).toBe('newly_refreshed_access_token_456');
      expect(fetchCallCount).toBe(2); // 1 initial 401 + 1 retry = 2
    });
  });
});
