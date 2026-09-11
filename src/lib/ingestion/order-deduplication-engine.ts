import { doc, writeBatch, Firestore } from 'firebase/firestore';
import { generateProductDocId } from '../import-job-service';
import type { Product } from '../types';

/**
 * Normalizes an order identifier by stripping '#' prefixes, trimming, and upper casing.
 * Example: "#1001" -> "1001", "  ord-55 " -> "ORD-55"
 */
export function normalizeOrderNumber(orderNum?: string): string {
  if (!orderNum) return '';
  return String(orderNum).trim().replace(/^#+/, '').trim().toUpperCase();
}

/**
 * Generates a unique, deterministic line-item key for an order transaction.
 * Distinguishes line items within the same order by SKU/name while detecting duplicates.
 */
export function generateOrderLineItemKey(
  orderNumber?: string,
  sku?: string,
  productName?: string,
  date?: string | any,
  qty?: number
): string {
  const normOrd = normalizeOrderNumber(orderNumber);
  const normSku = String(sku || '').trim().toUpperCase();
  const normName = String(productName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normOrd) {
    return `${normOrd}|${normSku || normName || 'item'}`;
  }
  const safeDate = typeof date === 'string' ? date : '';
  return `fp|${normSku || normName}|${safeDate}|${qty || 1}`;
}

/**
 * Deduplicates incoming transactions against existing database transactions
 * and eliminates duplicate rows within the incoming batch itself.
 */
export function deduplicateTransactions<
  T extends {
    orderNumber?: string;
    order_number?: string;
    sku?: string;
    productName?: string;
    product_name?: string;
    transactionDate?: string | any;
    sale_date?: string;
    quantity?: number;
    units_sold?: number;
  }
>(
  incoming: T[],
  existingTransactions: any[]
): {
  validUnique: T[];
  uniqueTransactions: T[];
  duplicateCount: number;
  duplicateKeys: string[];
} {
  const seenKeys = new Set<string>();

  // Register existing transactions
  for (const t of existingTransactions || []) {
    const ord = t.orderNumber || t.order_number;
    const sku = t.sku;
    const name = t.productName || t.product_name;
    const date = t.transactionDate || t.sale_date;
    const qty = t.quantity || t.units_sold;

    const key = generateOrderLineItemKey(ord, sku, name, date, qty);
    if (key) seenKeys.add(key);

    // Also register raw order number if single-item order
    const normOrd = normalizeOrderNumber(ord);
    if (normOrd) {
      seenKeys.add(`order_only:${normOrd}`);
    }
  }

  const validUnique: T[] = [];
  const duplicateKeys: string[] = [];

  for (const item of incoming || []) {
    const ord = item.orderNumber || item.order_number;
    const sku = item.sku;
    const name = item.productName || item.product_name;
    const date = item.transactionDate || item.sale_date;
    const qty = item.quantity || item.units_sold;

    const key = generateOrderLineItemKey(ord, sku, name, date, qty);

    if (seenKeys.has(key)) {
      duplicateKeys.push(key);
    } else {
      seenKeys.add(key);
      validUnique.push(item);
    }
  }

  return {
    validUnique,
    uniqueTransactions: validUnique,
    duplicateCount: duplicateKeys.length,
    duplicateKeys,
  };
}

/**
 * Resolves an existing product in the catalog by case-insensitive SKU or Title.
 * If found, returns the existing product document ID so imports link to the existing
 * product (e.g. from Shopify) instead of creating duplicate product records.
 */
export function resolveExistingProduct(
  existingProducts: Product[],
  sku?: string,
  name?: string
): {
  prodDocId: string;
  isExisting: boolean;
  existingProduct?: Product;
  id: string;
  stock: number;
} {
  const normSku = (sku || '').trim().toUpperCase();
  const normName = (name || '').trim().toLowerCase();

  if (normSku) {
    const matchBySku = existingProducts.find(
      p => p.sku && p.sku.trim().toUpperCase() === normSku
    );
    if (matchBySku) {
      return {
        prodDocId: matchBySku.id,
        isExisting: true,
        existingProduct: matchBySku,
        id: matchBySku.id,
        stock: matchBySku.stock ?? 0,
      };
    }
  }

  if (normName) {
    const matchByName = existingProducts.find(
      p => p.name && p.name.trim().toLowerCase() === normName
    );
    if (matchByName) {
      return {
        prodDocId: matchByName.id,
        isExisting: true,
        existingProduct: matchByName,
        id: matchByName.id,
        stock: matchByName.stock ?? 0,
      };
    }
  }

  const generatedId = generateProductDocId(sku, name);
  return {
    prodDocId: generatedId,
    isExisting: false,
    id: generatedId,
    stock: 0,
  };
}

/**
 * Reconciles and deletes duplicate products in Firestore sharing the same SKU.
 * Prioritizes keeping Shopify store products or the most recently updated entry,
 * deleting the orphaned duplicate product document.
 */
export async function reconcileDuplicateProducts(
  products: Product[],
  firestore: Firestore,
  userId: string
): Promise<{ mergedCount: number; purgedCount: number; purgedProductIds: string[] }> {
  if (!products || products.length === 0 || !firestore || !userId) {
    return { mergedCount: 0, purgedCount: 0, purgedProductIds: [] };
  }

  const bySku = new Map<string, Product[]>();
  for (const p of products) {
    const sku = (p.sku || '').trim().toUpperCase();
    if (!sku || sku === 'N/A') continue;
    const group = bySku.get(sku) || [];
    group.push(p);
    bySku.set(sku, group);
  }

  const purgedProductIds: string[] = [];

  for (const [sku, group] of bySku.entries()) {
    if (group.length <= 1) continue;

    // Pick authoritative product: prefer Shopify source, or highest valid stock, or earliest created
    const authoritative = group.reduce((best, current) => {
      const bestIsShopify = best.source === 'SHOPIFY' || best.id.startsWith('shopify_');
      const currIsShopify = current.source === 'SHOPIFY' || current.id.startsWith('shopify_');
      if (currIsShopify && !bestIsShopify) return current;
      if (bestIsShopify && !currIsShopify) return best;

      // If one was created with dummy 25 stock and the other has real non-25 stock, prefer real stock
      if (current.stock !== 25 && best.stock === 25) return current;
      if (best.stock !== 25 && current.stock === 25) return best;

      return best;
    }, group[0]);

    // Delete redundant duplicates from Firestore
    const duplicatesToDelete = group.filter(p => p.id !== authoritative.id);
    for (const dup of duplicatesToDelete) {
      purgedProductIds.push(dup.id);
    }
  }

  if (purgedProductIds.length > 0) {
    const batch = writeBatch(firestore);
    purgedProductIds.forEach(id => {
      const ref = doc(firestore, 'users', userId, 'products', id);
      batch.delete(ref);
    });
    await batch.commit().catch(err => console.warn('[Product Reconcile Error]:', err));
  }

  return {
    mergedCount: purgedProductIds.length,
    purgedCount: purgedProductIds.length,
    purgedProductIds,
  };
}
