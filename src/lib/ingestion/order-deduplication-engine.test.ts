import { describe, it, expect, vi } from 'vitest';

const mockDelete = vi.fn();
const mockCommit = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') }));

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    delete: mockDelete,
    commit: mockCommit,
  })),
  doc: (db: any, ...segments: string[]) => mockDoc(db, ...segments),
}));

import {
  normalizeOrderNumber,
  generateOrderLineItemKey,
  deduplicateTransactions,
  resolveExistingProduct,
  reconcileDuplicateProducts,
} from './order-deduplication-engine';
import type { Product, Transaction } from '@/lib/types';

describe('Order Deduplication & Zero Default Engine', () => {
  describe('normalizeOrderNumber', () => {
    it('normalizes leading hashtags and whitespace', () => {
      expect(normalizeOrderNumber('#1001')).toBe('1001');
      expect(normalizeOrderNumber('  #1001  ')).toBe('1001');
      expect(normalizeOrderNumber('1001')).toBe('1001');
      expect(normalizeOrderNumber('#ord-992')).toBe('ORD-992');
    });

    it('returns empty string for null, undefined or empty input', () => {
      expect(normalizeOrderNumber('')).toBe('');
      expect(normalizeOrderNumber(null as any)).toBe('');
      expect(normalizeOrderNumber(undefined)).toBe('');
    });
  });

  describe('generateOrderLineItemKey', () => {
    it('generates consistent keys regardless of order number formatting', () => {
      const key1 = generateOrderLineItemKey('#1001', 'SNK-ELV12-07', 'SNKHED Elevate 12');
      const key2 = generateOrderLineItemKey('1001', 'snk-elv12-07', 'SNKHED Elevate 12');
      expect(key1).toBe(key2);
      expect(key1).toBe('1001|SNK-ELV12-07');
    });

    it('generates distinct keys for multi-line items under the same order number', () => {
      const itemA = generateOrderLineItemKey('#1001', 'SNK-ELV12-07', 'SNKHED Elevate 12 (7)');
      const itemB = generateOrderLineItemKey('#1001', 'SNK-ELV12-08', 'SNKHED Elevate 12 (8)');
      expect(itemA).not.toBe(itemB);
    });

    it('falls back to product name if SKU is absent', () => {
      const key = generateOrderLineItemKey('ORD-55', '', 'Classic White Tee');
      expect(key).toBe('ORD-55|classicwhitetee');
    });
  });

  describe('deduplicateTransactions', () => {
    it('skips incoming transactions that already exist in the database', () => {
      const existing: Transaction[] = [
        {
          id: 'tx_1',
          orderNumber: '#1001',
          sku: 'SNK-ELV12-07',
          productName: 'SNKHED Elevate 12',
          quantity: 1,
          price: 1999,
          totalRevenue: 1999,
          transactionDate: '2026-09-10',
          status: 'Completed',
          paymentMethod: 'UPI',
        } as any,
      ];

      const incoming = [
        // Duplicate order item (without #)
        {
          orderNumber: '1001',
          sku: 'SNK-ELV12-07',
          productName: 'SNKHED Elevate 12',
          quantity: 1,
          price: 1999,
          totalRevenue: 1999,
          transactionDate: '2026-09-10',
          status: 'Completed',
          paymentMethod: 'UPI',
        },
        // Brand new order item
        {
          orderNumber: '1002',
          sku: 'SNK-ELV12-08',
          productName: 'SNKHED Elevate 12 (8)',
          quantity: 1,
          price: 1999,
          totalRevenue: 1999,
          transactionDate: '2026-09-10',
          status: 'Completed',
          paymentMethod: 'UPI',
        },
      ];

      const { uniqueTransactions, duplicateCount } = deduplicateTransactions(incoming as any, existing);
      expect(duplicateCount).toBe(1);
      expect(uniqueTransactions.length).toBe(1);
      expect(uniqueTransactions[0].orderNumber).toBe('1002');
    });

    it('filters out intra-batch duplicate records within the same CSV file', () => {
      const incoming = [
        {
          orderNumber: '1001',
          sku: 'SNK-ELV12-07',
          productName: 'SNKHED Elevate 12',
          quantity: 1,
        },
        {
          orderNumber: '1001',
          sku: 'SNK-ELV12-07',
          productName: 'SNKHED Elevate 12',
          quantity: 1,
        },
      ];

      const { uniqueTransactions, duplicateCount } = deduplicateTransactions(incoming as any, []);
      expect(duplicateCount).toBe(1);
      expect(uniqueTransactions.length).toBe(1);
    });

    it('preserves multi-line items with distinct SKUs in the same order', () => {
      const incoming = [
        {
          orderNumber: '1001',
          sku: 'SNK-ELV12-07',
          productName: 'SNKHED Elevate 12 (7)',
          quantity: 1,
        },
        {
          orderNumber: '1001',
          sku: 'SNK-ELV12-08',
          productName: 'SNKHED Elevate 12 (8)',
          quantity: 1,
        },
      ];

      const { uniqueTransactions, duplicateCount } = deduplicateTransactions(incoming as any, []);
      expect(duplicateCount).toBe(0);
      expect(uniqueTransactions.length).toBe(2);
    });
  });

  describe('resolveExistingProduct', () => {
    const catalog: Product[] = [
      {
        id: 'shopify_product_123',
        sku: 'SNK-ELV12-07',
        name: 'SNKHED Elevate 12 (7)',
        stock: 10,
        price: 2499,
        source: 'SHOPIFY',
      } as any,
      {
        id: 'prod_tee_blue',
        sku: 'TEE-BLU-L',
        name: 'Classic Blue Tee (L)',
        stock: 40,
        price: 799,
      } as any,
    ];

    it('matches an incoming record by exact SKU', () => {
      const match = resolveExistingProduct(catalog, 'SNK-ELV12-07', 'SNKHED Elevate 12 - Size 7');
      expect(match.isExisting).toBe(true);
      expect(match.id).toBe('shopify_product_123');
      expect(match.stock).toBe(10);
    });

    it('matches an incoming record by case-insensitive trimmed SKU', () => {
      const match = resolveExistingProduct(catalog, '  snk-elv12-07  ', 'Different Name');
      expect(match.isExisting).toBe(true);
      expect(match.id).toBe('shopify_product_123');
    });

    it('matches an incoming record by title if SKU is not provided', () => {
      const match = resolveExistingProduct(catalog, '', 'Classic Blue Tee (L)');
      expect(match.isExisting).toBe(true);
      expect(match.id).toBe('prod_tee_blue');
    });

    it('returns isExisting: false with generated ID if product does not exist in catalog', () => {
      const match = resolveExistingProduct(catalog, 'NEW-ITEM-99', 'Totally New Product');
      expect(match.isExisting).toBe(false);
      expect(match.existingProduct).toBeUndefined();
      expect(match.stock).toBe(0);
      expect(match.id).toContain('new-item-99');
    });
  });

  describe('reconcileDuplicateProducts', () => {
    it('purges phantom product documents sharing the same SKU and keeps the authoritative Shopify product', async () => {
      const products: Product[] = [
        // Authoritative Shopify product with real stock (10 units)
        {
          id: 'shopify_12345',
          sku: 'SNK-ELV12-07',
          name: 'SNKHED Elevate 12 (7)',
          stock: 10,
          shopifyProductId: 'shop_prod_1',
          source: 'SHOPIFY',
        } as any,
        // Duplicate phantom product with dummy 25 stock from sales CSV
        {
          id: 'prod_snk_elv12_07',
          sku: 'SNK-ELV12-07',
          name: 'SNKHED Elevate 12 - 7',
          stock: 25,
        } as any,
      ];

      mockDelete.mockClear();
      mockCommit.mockClear();
      mockDoc.mockClear();

      const mockFirestore = {} as any;
      const result = await reconcileDuplicateProducts(products, mockFirestore, 'test_user_uid');

      expect(result.purgedCount).toBe(1);
      expect(result.purgedProductIds).toContain('prod_snk_elv12_07');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
    });
  });
});
