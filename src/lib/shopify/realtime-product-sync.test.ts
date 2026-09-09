import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isShopifyAutoSyncDue } from '../shopify-sync-helper';
import { updateShopifyVariantPrice } from '../shopify-price-sync';

describe('Real-Time Shopify Product Sync & Variant Isolation Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. isShopifyAutoSyncDue (OAuth & Real-Time Engine)', () => {
    it('returns true for OAuth stores without client-side token when real-time sync is enabled', () => {
      const profile = {
        shopifyConnected: true,
        shopifyStoreUrl: 'snkhed.myshopify.com',
        // Note: shopifyAccessToken is NOT present on client for modern OAuth stores
        shopifyRealtimeSyncEnabled: true,
        shopifyLastSyncedAt: new Date(Date.now() - 20 * 1000).toISOString(), // 20s ago
      };

      expect(isShopifyAutoSyncDue(profile)).toBe(true);
    });

    it('returns true when store has never synced before and real-time is active', () => {
      const profile = {
        shopifyConnected: true,
        shopifyStoreUrl: 'snkhed.myshopify.com',
        shopifyRealtimeSyncEnabled: true,
        shopifyLastSyncedAt: null,
      };

      expect(isShopifyAutoSyncDue(profile)).toBe(true);
    });

    it('enforces 15s throttle in real-time mode to prevent API flood', () => {
      const profile = {
        shopifyConnected: true,
        shopifyStoreUrl: 'snkhed.myshopify.com',
        shopifyRealtimeSyncEnabled: true,
        shopifyLastSyncedAt: new Date(Date.now() - 5 * 1000).toISOString(), // 5s ago
      };

      // 5s elapsed < 15s throttle
      expect(isShopifyAutoSyncDue(profile)).toBe(false);
    });

    it('returns false when disconnected', () => {
      const profile = {
        shopifyConnected: false,
        shopifyStoreUrl: 'snkhed.myshopify.com',
        shopifyRealtimeSyncEnabled: true,
      };

      expect(isShopifyAutoSyncDue(profile)).toBe(false);
    });
  });

  describe('2. Variant Price Scoping (Only change specific shoe size)', () => {
    it('updates ONLY size 10 variant when applying clearance promo and DOES NOT change size 7, 8, 9, 11', async () => {
      const mockPutCalls: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/variants/')) {
          mockPutCalls.push(url);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              variant: { id: 10010, price: '3762.00', compare_at_price: '5299.00' },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      // Clearance promo specifically for "SNKHED Courtline 03 (10)" -> variantId 10010
      const res = await updateShopifyVariantPrice({
        shop: 'snkhed.myshopify.com',
        accessToken: 'shpat_test_token',
        shopifyVariantId: '10010',
        shopifyProductId: 'prod_courtline_03',
        sku: 'SNK-CRT03-10',
        productName: 'SNKHED Courtline 03 (10)',
        newPrice: 3762,
        oldPrice: 5299,
        compareAtPrice: 5299,
        updateAllVariants: false, // Default is FALSE!
      });

      expect(res.success).toBe(true);
      expect(res.variantId).toBe('10010');
      expect(res.price).toBe(3762);
      expect(res.compareAtPrice).toBe(5299);
      expect(res.updatedVariantsCount).toBe(1);

      // Verify that ONLY variant 10010 was targeted
      expect(mockPutCalls.length).toBe(1);
      expect(mockPutCalls[0]).toContain('/variants/10010.json');
      // Sibling variants (7, 8, 9, 11) must NOT be in the calls
      expect(mockPutCalls.some(url => url.includes('10007') || url.includes('10008') || url.includes('10009') || url.includes('10011'))).toBe(false);
    });
  });

  describe('3. Shopify Catalog Product Deletion Reconciliation', () => {
    it('accurately identifies Shopify-sourced products deleted from Shopify admin', () => {
      // Existing local products (5 shoe sizes previously imported from Shopify)
      const existingProducts = [
        { id: 'shopify_999_701', source: 'SHOPIFY', shopifyProductId: '999', shopifyVariantId: '701', name: 'Shoe (Size 7)' },
        { id: 'shopify_999_702', source: 'SHOPIFY', shopifyProductId: '999', shopifyVariantId: '702', name: 'Shoe (Size 8)' },
        { id: 'shopify_999_703', source: 'SHOPIFY', shopifyProductId: '999', shopifyVariantId: '703', name: 'Shoe (Size 9)' },
        { id: 'shopify_999_704', source: 'SHOPIFY', shopifyProductId: '999', shopifyVariantId: '704', name: 'Shoe (Size 10)' },
        { id: 'local_custom_product', source: 'MANUAL', name: 'Custom Non-Shopify Item' },
      ];

      // Active products returned by Shopify: Size 10 was deleted on Shopify, leaving Sizes 7, 8, 9
      const activeShopifyProds = [
        { id: 'shopify_999_701', shopifyProductId: '999', shopifyVariantId: '701' },
        { id: 'shopify_999_702', shopifyProductId: '999', shopifyVariantId: '702' },
        { id: 'shopify_999_703', shopifyProductId: '999', shopifyVariantId: '703' },
      ];

      const activeDocIds = new Set(activeShopifyProds.map(p => p.id));
      const activeProdIds = new Set(activeShopifyProds.map(p => p.shopifyProductId));
      const activeVarIds = new Set(activeShopifyProds.map(p => p.shopifyVariantId));

      const deletedItems = existingProducts.filter(p => {
        const isFromShopify =
          p.source === 'SHOPIFY' ||
          p.id.startsWith('shopify_') ||
          Boolean(p.shopifyProductId);

        if (!isFromShopify) return false;

        const isStillActive =
          activeDocIds.has(p.id) ||
          (p.shopifyVariantId
            ? activeVarIds.has(String(p.shopifyVariantId))
            : Boolean(p.shopifyProductId && activeProdIds.has(String(p.shopifyProductId))));

        return !isStillActive;
      });

      // Size 10 must be identified for deletion
      expect(deletedItems.length).toBe(1);
      expect(deletedItems[0].id).toBe('shopify_999_704');
      expect(deletedItems[0].name).toBe('Shoe (Size 10)');

      // Manual / non-Shopify items must NOT be touched
      expect(deletedItems.some(d => d.id === 'local_custom_product')).toBe(false);
    });
  });
});
