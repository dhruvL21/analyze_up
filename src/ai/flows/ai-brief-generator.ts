import { z } from 'zod';
import type { Product, Transaction } from '@/lib/types';
import type { IntelligenceCapabilities, DataReadiness } from '@/lib/data-readiness-engine';

/* ------------------ SCHEMAS ------------------ */

const AIBriefOutputSchema = z.object({
  healthScore: z.number().min(0).max(100),
  stockoutItem: z.object({
    name: z.string(),
    riskText: z.string(),
    reorderText: z.string(),
    costText: z.string(),
  }),
  slowMovingItem: z.object({
    name: z.string(),
    riskText: z.string(),
    costText: z.string(),
    actionText: z.string(),
  }),
  savingsText: z.string(),
});

export type AIBriefOutput = z.infer<typeof AIBriefOutputSchema>;

export interface CalculateDynamicBriefOptions {
  capabilities?: IntelligenceCapabilities;
  dataReadiness?: DataReadiness;
}

/* ------------------ EXPORT ------------------ */

export function calculateDynamicBrief(
  products: Product[],
  transactions: Transaction[] = [],
  options?: CalculateDynamicBriefOptions
): AIBriefOutput {
  if (!products || products.length === 0) {
    return {
      healthScore: 0,
      stockoutItem: {
        name: 'No Data Connected',
        riskText: 'No inventory dataset loaded.',
        reorderText: 'Upload CSV or connect Shopify.',
        costText: 'Estimated cost: ₹0'
      },
      slowMovingItem: {
        name: 'No Data Connected',
        riskText: 'No inventory dataset loaded.',
        costText: '₹0 blocked.',
        actionText: 'Upload CSV or connect Shopify.'
      },
      savingsText: 'Cash Locked in Inventory: ₹0'
    };
  }

  // High-performance single-pass linear scan across products
  let stockoutCount = 0;
  let lowStockCount = 0;
  let totalLockedCapital = 0;

  let highestRiskItem: Product | null = null;
  let minRunway = Infinity;

  let worstSlowMovingItem: Product | null = null;
  let maxBlockedCapital = -1;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const stock = Number(p.stock) || 0;
    const minStock = Number(p.minStock) || 5;
    const price = Number(p.price) || 0;
    const costPrice = Number(p.costPrice) || price * 0.6 || 0;

    totalLockedCapital += stock * costPrice;

    if (stock === 0) {
      stockoutCount++;
    } else if (stock <= minStock) {
      lowStockCount++;
    }

    // Runway calculation (stock / averageDailySales)
    const ads = Number(p.averageDailySales) || 0.1;
    const runway = stock / ads;
    if (runway < minRunway) {
      minRunway = runway;
      highestRiskItem = p;
    }

    // Blocked capital calculation
    const blocked = stock * costPrice;
    if (blocked > maxBlockedCapital) {
      maxBlockedCapital = blocked;
      worstSlowMovingItem = p;
    }
  }

  // Calculate Health Score
  let score = 100;
  const stockoutPercentage = stockoutCount / products.length;
  const lowStockPercentage = lowStockCount / products.length;
  score -= Math.round(stockoutPercentage * 50);
  score -= Math.round(lowStockPercentage * 25);
  score = Math.max(0, Math.min(100, score));

  // Build Stockout Risk Item
  let stockoutItem = {
    name: 'None',
    riskText: 'All items are fully stocked.',
    reorderText: 'No reorder needed.',
    costText: 'Estimated cost: ₹0'
  };

  if (highestRiskItem) {
    const stock = Number(highestRiskItem.stock) || 0;
    const ads = Number(highestRiskItem.averageDailySales) || 0.5;
    const runwayDays = Math.max(1, Math.ceil(stock / ads));
    const reorderQty = Math.max(10, Math.ceil(ads * 15 - stock));
    const costPrice = Number(highestRiskItem.costPrice) || Number(highestRiskItem.price) * 0.6 || 0;
    const estimatedCost = Math.round(reorderQty * costPrice);

    const isStockoutPredictive = options?.capabilities?.stockoutPrediction ?? true;
    let riskText = 'Adequate stock runway.';
    if (stock === 0) {
      riskText = 'Out of stock.';
    } else if (isStockoutPredictive) {
      riskText = `Stockout risk in ${runwayDays} days.`;
    } else if (stock <= (highestRiskItem.minStock || 5)) {
      riskText = 'Low stock in warehouse.';
    }

    stockoutItem = {
      name: highestRiskItem.name || 'Unnamed Product',
      riskText,
      reorderText: `Suggested reorder: ${reorderQty} units.`,
      costText: `Estimated cost: ₹${estimatedCost.toLocaleString('en-IN')}`
    };
  }

  // Build Slow Moving Item
  let slowMovingItem = {
    name: 'None',
    riskText: 'No slow-moving inventory detected.',
    costText: '₹0 blocked.',
    actionText: 'No action suggested.'
  };

  if (worstSlowMovingItem) {
    const stock = Number(worstSlowMovingItem.stock) || 0;
    const price = Number(worstSlowMovingItem.price) || 0;
    const costPrice = Number(worstSlowMovingItem.costPrice) || price * 0.6 || 0;
    const blockedCapital = Math.round(stock * costPrice);

    const isPredictiveSlowMover = options?.capabilities?.slowMoverDetection && options?.dataReadiness?.level !== 'LEARNING';
    const isDiscountEligible = options?.capabilities?.discountRecommendations ?? false;

    if (!isPredictiveSlowMover) {
      const historyDays = options?.dataReadiness?.historicalDays ?? 0;
      slowMovingItem = {
        name: worstSlowMovingItem.name || 'Unnamed Product',
        riskText: `Catalog In Holding Cycle (${historyDays} days observed).`,
        costText: `₹${blockedCapital.toLocaleString('en-IN')} blocked.`,
        actionText: 'Action: Monitor Velocity'
      };
    } else {
      // Find actual latest sale timestamp from transactions
      const targetName = (worstSlowMovingItem.name || '').toLowerCase();
      const targetId = worstSlowMovingItem.id;
      let latestSaleDate: number | null = null;
      const now = Date.now();

      for (let t = 0; t < transactions.length; t++) {
        const tx = transactions[t];
        if ((tx.type === 'Sale' || (tx as any).type === 'sale') && ((tx.productName && tx.productName.toLowerCase() === targetName) || tx.productId === targetId)) {
          const rawDate = tx.transactionDate || (tx as any).createdAt;
          const ts = typeof rawDate === 'string' ? new Date(rawDate).getTime() : (typeof rawDate === 'number' ? rawDate : null);
          if (ts && (!latestSaleDate || ts > latestSaleDate)) latestSaleDate = ts;
        }
      }

      const daysSinceLastSale = latestSaleDate
        ? Math.max(1, Math.round((now - latestSaleDate) / (1000 * 60 * 60 * 24)))
        : Math.min(30, options?.dataReadiness?.historicalDays || 30);

      slowMovingItem = {
        name: worstSlowMovingItem.name || 'Unnamed Product',
        riskText: `Low velocity (${daysSinceLastSale} days).`,
        costText: `₹${blockedCapital.toLocaleString('en-IN')} blocked.`,
        actionText: isDiscountEligible ? 'Suggested action: 20% Discount' : 'Action: Monitor Velocity'
      };
    }
  }

  const savingsText = `Cash Locked in Inventory: ₹${Math.round(totalLockedCapital).toLocaleString('en-IN')}`;

  return {
    healthScore: score,
    stockoutItem,
    slowMovingItem,
    savingsText
  };
}
