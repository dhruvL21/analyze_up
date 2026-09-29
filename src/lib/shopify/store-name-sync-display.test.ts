import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPilotAuthorizedStore, sanitizeShopDomain } from '@/lib/shopify/config';
import { NextRequest } from 'next/server';
import { POST as syncRouteHandler } from '@/app/api/shopify/sync/route';
import { saveShopifyConnection, getShopifyConnection } from '@/lib/shopify/connection-store';
import { encryptShopifyToken } from '@/lib/shopify/crypto';

describe('Store Name Display, Adoption & Sync Authorization Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly identifies pilot authorized stores', () => {
    expect(isPilotAuthorizedStore('snkhed.myshopify.com')).toBe(true);
    expect(isPilotAuthorizedStore('14aj1c-0a.myshopify.com')).toBe(true);
    expect(isPilotAuthorizedStore('https://snkhed.myshopify.com/admin')).toBe(true);
    expect(isPilotAuthorizedStore('14aj1c-0a')).toBe(true);
    expect(isPilotAuthorizedStore('random-unauthorized-store.myshopify.com')).toBe(false);
  });

  it('allows authorized pilot store to sync and reassign ownership without 403 Forbidden', async () => {
    const shop = '14aj1c-0a.myshopify.com';
    
    // Seed an existing connection owned by prior test tenant "user_previous"
    await saveShopifyConnection({
      id: `conn_user_previous_${shop}`,
      tenantId: 'user_previous',
      shopDomain: shop,
      encryptedAccessToken: encryptShopifyToken('shpat_pilot_test_token_123'),
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastTokenRefreshAt: null,
      status: 'ACTIVE',
      requestedScopes: ['read_products', 'read_orders'],
      grantedScopes: ['read_products', 'read_orders'],
      missingScopes: [],
      storeName: 'SNKHED',
      companyName: 'SNKHED',
      currency: 'INR',
      primaryLocationId: null,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Mock global fetch for Shopify REST endpoints
    const globalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({}),
          json: () => Promise.resolve({ products: [] }),
        });
      }
      if (url.includes('/orders.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({}),
          json: () => Promise.resolve({ orders: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: () => Promise.resolve({}),
      });
    });

    // Make request from a NEW tenant "user_new_pilot"
    const req = new NextRequest('http://localhost:9002/api/shopify/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-tenant-id': 'user_new_pilot',
      },
      body: JSON.stringify({
        shop,
      }),
    });

    const res = await syncRouteHandler(req);
    const data = await res.json();

    // Verify it did NOT fail with 403 Forbidden
    expect(res.status).not.toBe(403);
    expect(data.success).toBe(true);
    expect(data.storeName).toBe('SNKHED');
    expect(data.companyName).toBe('SNKHED');

    // Verify ownership was safely reassigned to the new pilot tenant
    const updatedConn = await getShopifyConnection(shop);
    expect(updatedConn?.tenantId).toBe('user_new_pilot');

    global.fetch = globalFetch;
  });
});
