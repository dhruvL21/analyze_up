import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateShopifyVariantPrice } from './shopify-price-sync';
import { getShopifyApiVersion } from './shopify/config';

describe('Shopify Price & Discount Sync Engine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects invalid shop URL or empty access token', async () => {
    const res1 = await updateShopifyVariantPrice({
      shop: 'invalid-url',
      accessToken: 'token123',
      newPrice: 1999,
    });
    expect(res1.success).toBe(false);

    const res2 = await updateShopifyVariantPrice({
      shop: 'test-store.myshopify.com',
      accessToken: '',
      newPrice: 1999,
    });
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('access token');
  });

  it('updates variant price directly when shopifyVariantId is provided and sets compare_at_price on discount', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        variant: {
          id: 9001,
          price: '3999.00',
          compare_at_price: '4999.00',
        },
      }),
    } as any);

    const res = await updateShopifyVariantPrice({
      shop: 'mystore.myshopify.com',
      accessToken: 'shpat_valid123',
      shopifyVariantId: '9001',
      newPrice: 3999,
      oldPrice: 4999,
    });

    expect(res.success).toBe(true);
    expect(res.variantId).toBe('9001');
    expect(res.price).toBe(3999);
    expect(res.compareAtPrice).toBe(4999);

    const apiVersion = getShopifyApiVersion();
    expect(global.fetch).toHaveBeenCalledWith(
      `https://mystore.myshopify.com/admin/api/${apiVersion}/variants/9001.json`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          variant: {
            id: '9001',
            price: '3999.00',
            compare_at_price: '4999.00',
          },
        }),
      })
    );
  });

  it('parses variantId from canonical ID format shopify_{prodId}_{variantId}', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        variant: {
          id: 4567,
          price: '899.00',
          compare_at_price: '1199.00',
        },
      }),
    } as any);

    const res = await updateShopifyVariantPrice({
      shop: 'mystore.myshopify.com',
      accessToken: 'shpat_valid123',
      productId: 'shopify_1234_4567',
      newPrice: 899,
      oldPrice: 1199,
    });

    expect(res.success).toBe(true);
    expect(res.variantId).toBe('4567');
    expect(res.price).toBe(899);
  });

  it('handles 403 Forbidden with clear permission notice', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as any);

    const res = await updateShopifyVariantPrice({
      shop: 'mystore.myshopify.com',
      accessToken: 'shpat_restricted',
      shopifyVariantId: '9001',
      newPrice: 2499,
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe(403);
    expect(res.scopeMissing).toBe('write_products');
    expect(res.error).toContain('write_products');
  });

  it('does NOT update sibling variants by default (isolating specific shoe size)', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/products/555.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            product: {
              id: 555,
              variants: [
                { id: 701, title: 'Size 7', sku: 'SNK-VEL14-07', price: '5899.00' },
                { id: 702, title: 'Size 8', sku: 'SNK-VEL14-08', price: '5899.00' },
              ],
            },
          }),
        };
      }
      if (url.includes('/variants/701.json') || url.includes('/variants/702.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            variant: { id: 701, price: '4188.00', compare_at_price: '5899.00' },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    // Default: updateAllVariants is not passed (or false)
    const res = await updateShopifyVariantPrice({
      shop: 'mystore.myshopify.com',
      accessToken: 'shpat_valid123',
      shopifyProductId: '555',
      newPrice: 4188,
      oldPrice: 5899,
    });

    expect(res.success).toBe(true);
    expect(res.updatedVariantsCount).toBe(1);
    const apiVersion = getShopifyApiVersion();
    // Only target variant 701 should have been called, NOT sibling 702
    expect(global.fetch).toHaveBeenCalledWith(
      `https://mystore.myshopify.com/admin/api/${apiVersion}/variants/701.json`,
      expect.anything()
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      `https://mystore.myshopify.com/admin/api/${apiVersion}/variants/702.json`,
      expect.anything()
    );
  });

  it('updates all sibling variants when updateAllVariants is explicitly true', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/products/555.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            product: {
              id: 555,
              variants: [
                { id: 701, title: 'Size 7', sku: 'SNK-VEL14-07', price: '5899.00' },
                { id: 702, title: 'Size 8', sku: 'SNK-VEL14-08', price: '5899.00' },
              ],
            },
          }),
        };
      }
      if (url.includes('/variants/701.json') || url.includes('/variants/702.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            variant: { id: 701, price: '4188.00', compare_at_price: '5899.00' },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const res = await updateShopifyVariantPrice({
      shop: 'mystore.myshopify.com',
      accessToken: 'shpat_valid123',
      shopifyProductId: '555',
      newPrice: 4188,
      oldPrice: 5899,
      updateAllVariants: true,
    });

    expect(res.success).toBe(true);
    expect(res.updatedVariantsCount).toBe(2);
    const apiVersion = getShopifyApiVersion();
    expect(global.fetch).toHaveBeenCalledWith(
      `https://mystore.myshopify.com/admin/api/${apiVersion}/variants/701.json`,
      expect.anything()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `https://mystore.myshopify.com/admin/api/${apiVersion}/variants/702.json`,
      expect.anything()
    );
  });
});
