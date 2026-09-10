import type { Product, Transaction } from './types';

export interface SalesHistoryEvaluation {
  hasMinimumHistory: boolean; // True if >= 30 days of sales history
  historyDays: number; // Number of days of sales history recorded in the dataset
  totalSaleTransactions: number;
  oldestSaleDate: string | null;
  newestSaleDate: string | null;
  isProductEligibleForDeadStock: (product: Product) => boolean;
  isProductEligibleForPriceUp: (product: Product) => boolean;
}

/**
 * Dynamically evaluates sales history duration and product eligibility for
 * AI predictions (clearance discounts and price optimization).
 *
 * Rules:
 * 1. AI cannot reliably recommend discounts (dead stock liquidation) or price hikes without
 *    at least 1 month (30 days) of historical sales data.
 * 2. If imported data has less than 30 days of sales history, predictions are NOT shown instantly;
 *    instead a dynamic informational state is presented until 30+ days of history exist.
 * 3. If a product has >= 30 days of history and 0 sales, it is eligible for dead stock clearance discount.
 * 4. If a product has >= 30 days of history and sustained high velocity, it is eligible for price optimization.
 * 5. A product can never be both dead stock and price optimization candidate.
 */
export function evaluateSalesHistory(
  products: Product[],
  transactions: Transaction[]
): SalesHistoryEvaluation {
  const saleTransactions = (transactions || []).filter((t) => t && t.type === 'Sale');
  const now = Date.now();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const validTimestamps = saleTransactions
    .map((t) => {
      const raw = t.transactionDate || (typeof t.createdAt === 'string' ? t.createdAt : '');
      if (!raw || typeof raw !== 'string') return null;
      const ts = new Date(raw).getTime();
      return isNaN(ts) || ts <= 0 ? null : ts;
    })
    .filter((ts): ts is number => ts !== null);

  let oldestSaleDate: string | null = null;
  let newestSaleDate: string | null = null;
  let historyDays = 0;

  if (validTimestamps.length > 0) {
    const minTs = Math.min(...validTimestamps);
    const maxTs = Math.max(...validTimestamps);
    oldestSaleDate = new Date(minTs).toISOString().split('T')[0];
    newestSaleDate = new Date(maxTs).toISOString().split('T')[0];

    // Measure date span between earliest sale and latest sale / now
    const spanBetweenSales = Math.max(1, Math.round((maxTs - minTs) / MS_PER_DAY));
    const spanFromOldestToNow = Math.max(1, Math.round((now - minTs) / MS_PER_DAY));
    historyDays = Math.max(spanBetweenSales, Math.min(spanFromOldestToNow, 365));
  }

  // Minimum 30 days of sales data required for predictive models
  const hasMinimumHistory = historyDays >= 30;

  // Build product-level sales metrics map with flexible matching
  const productSaleMetrics = new Map<
    string,
    { count: number; totalQty: number; earliestSaleTs: number; latestSaleTs: number }
  >();

  for (const t of saleTransactions) {
    const qty = Math.max(1, Number(t.quantity || 1));
    const rawDate = t.transactionDate || (typeof t.createdAt === 'string' ? t.createdAt : '');
    const ts = rawDate && typeof rawDate === 'string' ? new Date(rawDate).getTime() : NaN;

    // Match transaction to product by ID, Shopify ID, SKU, or Name
    const matchedProd = (products || []).find((p) => {
      if (!p) return false;
      const tProdId = String(t.productId || '').toLowerCase();
      const pId = String(p.id || '').toLowerCase();
      const pShopifyId = p.shopifyProductId ? String(p.shopifyProductId).toLowerCase() : '';
      const pVariantId = p.shopifyVariantId ? String(p.shopifyVariantId).toLowerCase() : '';

      if (tProdId && (tProdId === pId || (pShopifyId && tProdId === pShopifyId) || (pVariantId && tProdId === pVariantId))) {
        return true;
      }

      const pSku = p.sku ? String(p.sku).trim().toLowerCase() : '';
      const tSku = t.sku ? String(t.sku).trim().toLowerCase() : '';
      if (pSku && tSku && pSku === tSku) return true;

      const pName = (p.name || p.productName || '').trim().toLowerCase();
      const tName = (t.productName || '').trim().toLowerCase();
      if (pName && tName && (pName === tName || pName.startsWith(tName) || tName.startsWith(pName))) {
        return true;
      }

      return false;
    });

    if (matchedProd) {
      const existing = productSaleMetrics.get(matchedProd.id) || {
        count: 0,
        totalQty: 0,
        earliestSaleTs: ts,
        latestSaleTs: ts,
      };
      existing.count += 1;
      existing.totalQty += qty;
      if (!isNaN(ts) && ts > 0) {
        existing.earliestSaleTs = Math.min(existing.earliestSaleTs, ts);
        existing.latestSaleTs = Math.max(existing.latestSaleTs, ts);
      }
      productSaleMetrics.set(matchedProd.id, existing);
    }
  }

  const isProductEligibleForDeadStock = (p: Product): boolean => {
    // Rule: Cannot determine dead stock without at least 30 days of sales history in dataset
    if (!hasMinimumHistory) return false;
    if (!p || (p.stock || 0) <= 0) return false;

    // If product was created in the system less than 30 days ago, it's newly added, not dead stock
    if (typeof p.createdAt === 'string') {
      const createdTs = new Date(p.createdAt).getTime();
      if (!isNaN(createdTs) && now - createdTs < 30 * MS_PER_DAY && !productSaleMetrics.has(p.id)) {
        return false;
      }
    }

    // Must have 0 recorded sales over the minimum 30-day period
    const metrics = productSaleMetrics.get(p.id);
    return !metrics || metrics.count === 0 || metrics.totalQty === 0;
  };

  const isProductEligibleForPriceUp = (p: Product): boolean => {
    // Rule: Cannot determine sustained high velocity without at least 30 days of sales history
    if (!hasMinimumHistory) return false;
    if (!p || (p.price || 0) <= 0 || (p.stock || 0) <= 0) return false;

    // Must NOT be a dead stock item
    if (isProductEligibleForDeadStock(p)) return false;

    const metrics = productSaleMetrics.get(p.id);
    // If no sales exist in the 30-day period, cannot be high velocity
    if (!metrics || metrics.count === 0 || metrics.totalQty === 0) return false;

    // Calculate actual daily velocity over the history span
    const dailyVelocity = metrics.totalQty / Math.max(30, historyDays);
    const hasSustainedSales = metrics.totalQty >= 15 && dailyVelocity >= 0.5;
    const hasHighDailySales = (p.averageDailySales || 0) >= 0.8 && metrics.totalQty >= 10;

    return hasSustainedSales || hasHighDailySales;
  };

  return {
    hasMinimumHistory,
    historyDays,
    totalSaleTransactions: saleTransactions.length,
    oldestSaleDate,
    newestSaleDate,
    isProductEligibleForDeadStock,
    isProductEligibleForPriceUp,
  };
}
