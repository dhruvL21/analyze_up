import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeDisconnectedProfile } from '@/context/data-context';
import { markShopifyDisconnected, markShopifyUninstalled } from '@/lib/shopify/connection-store';
import { POST as resetWorkspaceHandler } from '@/app/api/workspace/reset/route';
import { NextRequest } from 'next/server';
import type { BusinessProfile } from '@/lib/types';

// Mock Firebase Admin SDK for testing server-side disconnect & workspace reset routes
const mockAdminStore = new Map<string, any>();

vi.mock('@/lib/firebase/admin', () => {
  const createDocRef = (collectionPath: string, docId: string) => ({
    id: docId,
    path: `${collectionPath}/${docId}`,
    set: async (data: any, options?: { merge?: boolean }) => {
      const key = `${collectionPath}/${docId}`;
      if (options?.merge && mockAdminStore.has(key)) {
        mockAdminStore.set(key, { ...mockAdminStore.get(key), ...data });
      } else {
        mockAdminStore.set(key, { ...data });
      }
    },
    get: async () => {
      const key = `${collectionPath}/${docId}`;
      const data = mockAdminStore.get(key);
      return {
        exists: Boolean(data),
        data: () => data,
      };
    },
    delete: async () => {
      mockAdminStore.delete(`${collectionPath}/${docId}`);
    },
    collection: (subColl: string) => createCollectionRef(`${collectionPath}/${docId}/${subColl}`),
  });

  const createCollectionRef = (collectionPath: string) => ({
    doc: (docId: string) => createDocRef(collectionPath, docId),
    get: async () => {
      const docs: any[] = [];
      for (const [key, value] of mockAdminStore.entries()) {
        if (key.startsWith(`${collectionPath}/`)) {
          const subId = key.replace(`${collectionPath}/`, '');
          docs.push({
            id: subId,
            ref: createDocRef(collectionPath, subId),
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

describe('Shopify Store Disconnect & Data Reset Scrub Suite', () => {
  beforeEach(() => {
    mockAdminStore.clear();
    vi.restoreAllMocks();
  });

  describe('sanitizeDisconnectedProfile', () => {
    it('returns null for null profile', () => {
      expect(sanitizeDisconnectedProfile(null)).toBeNull();
    });

    it('leaves active connected store profile intact with its store name and logo', () => {
      const activeProfile: BusinessProfile = {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        shopifyStoreName: '14aj1c-0a',
        shopifyStoreUrl: '14aj1c-0a.myshopify.com',
        shopifyConnected: true,
        shopifyStatus: 'Connected',
        logoUrl: 'https://example.com/store-logo.png',
        businessType: 'Retail',
        industry: 'General Retail Store',
        businessSize: '2-10 Employees',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (GMT+5:30)',
        country: 'India',
        language: 'English',
        isOnboardingCompleted: true,
      };

      const result = sanitizeDisconnectedProfile(activeProfile);
      expect(result?.businessName).toBe('14aj1c-0a');
      expect(result?.companyName).toBe('14aj1c-0a');
      expect(result?.logoUrl).toBe('https://example.com/store-logo.png');
      expect(result?.shopifyConnected).toBe(true);
    });

    it('scrubs store name and logo back to defaults when disconnected', () => {
      const disconnectedWithStaleData: BusinessProfile = {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        shopifyStoreName: '14aj1c-0a',
        shopifyStoreUrl: '',
        shopifyConnected: false,
        shopifyStatus: 'Disconnected',
        logoUrl: 'https://example.com/old-store-logo.png',
        businessType: 'Retail',
        industry: 'General Retail Store',
        businessSize: '2-10 Employees',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (GMT+5:30)',
        country: 'India',
        language: 'English',
        isOnboardingCompleted: true,
      };

      const result = sanitizeDisconnectedProfile(disconnectedWithStaleData);
      expect(result?.businessName).toBe('My Business');
      expect(result?.companyName).toBe('My Business');
      expect(result?.logoUrl).toBe('');
      expect(result?.shopifyStoreName).toBe('');
      expect(result?.shopifyConnected).toBe(false);
    });

    it('cleanses dev store handle pattern (14aj1c-0a) even if shopifyStoreName was already blank', () => {
      const lingeringHandleProfile: BusinessProfile = {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        shopifyStoreName: '',
        shopifyStoreUrl: '',
        shopifyConnected: false,
        shopifyStatus: 'Disconnected',
        logoUrl: 'https://example.com/old-store-logo.png',
        businessType: 'Retail',
        industry: 'General Retail Store',
        businessSize: '2-10 Employees',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (GMT+5:30)',
        country: 'India',
        language: 'English',
        isOnboardingCompleted: true,
      };

      const result = sanitizeDisconnectedProfile(lingeringHandleProfile);
      expect(result?.businessName).toBe('My Business');
      expect(result?.companyName).toBe('My Business');
      expect(result?.logoUrl).toBe('');
    });

    it('preserves genuine user-chosen business name when disconnected', () => {
      const customBizProfile: BusinessProfile = {
        businessName: 'Super Fashion Boutique',
        companyName: 'Super Fashion Boutique',
        shopifyStoreName: '',
        shopifyStoreUrl: '',
        shopifyConnected: false,
        shopifyStatus: 'Disconnected',
        logoUrl: 'https://example.com/custom-boutique.png',
        businessType: 'Retail',
        industry: 'General Retail Store',
        businessSize: '2-10 Employees',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (GMT+5:30)',
        country: 'India',
        language: 'English',
        isOnboardingCompleted: true,
      };

      const result = sanitizeDisconnectedProfile(customBizProfile);
      expect(result?.businessName).toBe('Super Fashion Boutique');
      expect(result?.companyName).toBe('Super Fashion Boutique');
      expect(result?.logoUrl).toBe('https://example.com/custom-boutique.png');
    });
  });

  describe('markShopifyDisconnected & markShopifyUninstalled Server Reset', () => {
    it('executes markShopifyDisconnected and resets profile businessName and logo', async () => {
      const tenantId = 'tenant_reset_1';
      // Seed initial business profile with Shopify store details
      mockAdminStore.set(`users/${tenantId}/settings/business_profile`, {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        logoUrl: 'https://example.com/logo.png',
        shopifyConnected: true,
        shopifyStoreName: '14aj1c-0a',
        shopifyStoreUrl: '14aj1c-0a.myshopify.com',
      });

      await markShopifyDisconnected('14aj1c-0a.myshopify.com', tenantId, true);

      const profile = mockAdminStore.get(`users/${tenantId}/settings/business_profile`);
      expect(profile).toBeDefined();
      expect(profile.businessName).toBe('My Business');
      expect(profile.companyName).toBe('My Business');
      expect(profile.logoUrl).toBe('');
      expect(profile.shopifyConnected).toBe(false);
      expect(profile.shopifyStoreName).toBe('');
      expect(profile.shopifyStoreUrl).toBe('');
    });

    it('executes markShopifyUninstalled and resets profile businessName and logo', async () => {
      const shop = 'uninstalled-test-shop.myshopify.com';
      const tenantId = 'tenant_uninstalled_2';
      // Seed connection
      mockAdminStore.set(`shopify_connections/${shop}`, {
        tenantId,
        shopDomain: shop,
        status: 'ACTIVE',
      });
      // Seed profile
      mockAdminStore.set(`users/${tenantId}/settings/business_profile`, {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        logoUrl: 'https://example.com/logo.png',
        shopifyConnected: true,
      });

      await markShopifyUninstalled(shop, true);

      const profile = mockAdminStore.get(`users/${tenantId}/settings/business_profile`);
      expect(profile).toBeDefined();
      expect(profile.businessName).toBe('My Business');
      expect(profile.companyName).toBe('My Business');
      expect(profile.logoUrl).toBe('');
      expect(profile.shopifyConnected).toBe(false);
    });
  });

  describe('POST /api/workspace/reset', () => {
    it('clears workspace, resets store name & logo back to defaults, and returns 200', async () => {
      const userId = 'test_user_reset_456';
      mockAdminStore.set(`users/${userId}/settings/business_profile`, {
        businessName: '14aj1c-0a',
        companyName: '14aj1c-0a',
        logoUrl: 'https://example.com/logo.png',
        shopifyConnected: true,
      });

      const req = new NextRequest('http://localhost:9002/api/workspace/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': userId,
        },
        body: JSON.stringify({ userId }),
      });

      const res = await resetWorkspaceHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const resetProfile = mockAdminStore.get(`users/${userId}/settings/business_profile`);
      expect(resetProfile.businessName).toBe('My Business');
      expect(resetProfile.companyName).toBe('My Business');
      expect(resetProfile.logoUrl).toBe('');
      expect(resetProfile.shopifyConnected).toBe(false);
    });
  });

  describe('Demo Business Profile Name & Logo Suite', () => {
    it('provides a valid non-empty DEMO_BUSINESS_NAME and SVG DEMO_BUSINESS_LOGO', async () => {
      const { DEMO_BUSINESS_NAME, DEMO_BUSINESS_LOGO } = await import('@/lib/demo-data');
      expect(DEMO_BUSINESS_NAME).toBe('Apex Lifestyle Co.');
      expect(DEMO_BUSINESS_LOGO).toContain('data:image/svg+xml');
      expect(DEMO_BUSINESS_LOGO).toContain('svg');
    });

    it('sanitizeDisconnectedProfile preserves demo business name and demo logo without wiping', async () => {
      const { DEMO_BUSINESS_NAME, DEMO_BUSINESS_LOGO } = await import('@/lib/demo-data');
      const demoProfile: BusinessProfile = {
        businessName: DEMO_BUSINESS_NAME,
        companyName: DEMO_BUSINESS_NAME,
        shopifyStoreName: '',
        shopifyStoreUrl: '',
        shopifyConnected: false,
        shopifyStatus: 'Disconnected',
        logoUrl: DEMO_BUSINESS_LOGO,
        businessType: 'Retail',
        industry: 'General Retail Store',
        businessSize: '2-10 Employees',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (GMT+5:30)',
        country: 'India',
        language: 'English',
        isOnboardingCompleted: true,
        inventorySetupMethod: 'demo',
      };

      const result = sanitizeDisconnectedProfile(demoProfile);
      expect(result?.businessName).toBe(DEMO_BUSINESS_NAME);
      expect(result?.companyName).toBe(DEMO_BUSINESS_NAME);
      expect(result?.logoUrl).toBe(DEMO_BUSINESS_LOGO);
      expect(result?.inventorySetupMethod).toBe('demo');
    });
  });
});
