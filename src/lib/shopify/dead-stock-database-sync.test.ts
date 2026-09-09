import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/shopify/price/update/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/shopify/auth-guard', () => ({
  resolveServerTenant: vi.fn().mockResolvedValue({ tenantId: 'test-user-123' }),
}));

vi.mock('@/lib/shopify/admin-api', () => ({
  getValidAccessToken: vi.fn().mockResolvedValue('shpat_mocked_token'),
}));

vi.mock('@/lib/shopify/connection-store', () => ({
  getShopifyConnectionByTenant: vi.fn().mockResolvedValue({
    shopDomain: 'test-store.myshopify.com',
  }),
}));

const { mockSet } = vi.hoisted(() => ({
  mockSet: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/firebase/admin', () => ({
  hasAdminCredentials: vi.fn().mockReturnValue(true),
  getAdminFirestore: vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            set: mockSet,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/shopify-price-sync', () => ({
  updateShopifyVariantPrice: vi.fn().mockResolvedValue({
    success: true,
    variantId: 'var-999',
    price: 4259,
    compareAtPrice: 5999,
    updatedVariantsCount: 1,
  }),
}));

describe('Clearance Apply & Database Persistence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates actual database and synchronizes with shopify via resolved server token', async () => {
    const req = new NextRequest('http://localhost:9002/api/shopify/price/update', {
      method: 'POST',
      body: JSON.stringify({
        productId: 'prod-snkhed-01',
        newPrice: 4259,
        oldPrice: 5999,
        compareAtPrice: 5999,
        productName: 'SNKHED Velocity 02 (7)',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.firestoreUpdated).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 4259,
        compareAtPrice: 5999,
        discountPercent: 29,
        liquidationStatus: 'Liquidated',
      }),
      { merge: true }
    );
  });
});
