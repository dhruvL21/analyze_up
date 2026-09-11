import type { Product, Transaction } from './types';
import { parseDateTimestamp } from './data-readiness-engine';

export type DeadStockRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface DeadStockAnalysisItem {
  product: Product;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  price: number;
  costPrice?: number;
  hasCostPrice: boolean;
  tiedUpCapital: number;

  totalUnitsSold: number;
  salesLast30Days: number;
  salesLast60Days: number;
  dailyVelocity: number;
  daysSinceLastSale: number | null;
  stockCoverageDays: number; // e.g. 840 days
  productAgeDays: number;

  riskLevel: DeadStockRiskLevel;
  urgencyScore: number; // 0 - 100
  recommendedDiscountPercent: number;
  recommendedNewPrice: number;
  estimatedCashUnlocked: number;

  whyExplanation: string;
  recommendedAction: string;
}

export interface DeadStockSummaryReport {
  totalDeadCapital: number;
  criticalRiskCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  items: DeadStockAnalysisItem[];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface AnalyzeDeadStockOptions {
  isDeadStockEnabled?: boolean;
  historicalDays?: number;
}

/**
 * Multi-Factor Dead Stock Risk Engine
 * Replaces naive `sales === 0` logic with comprehensive velocity and inventory coverage analysis.
 */
export function analyzeDeadStockRisk(
  products: Product[] = [],
  transactions: Transaction[] = [],
  options?: AnalyzeDeadStockOptions
): DeadStockSummaryReport {
  if (options?.isDeadStockEnabled === false || (options?.historicalDays !== undefined && options.historicalDays < 30)) {
    return {
      totalDeadCapital: 0,
      criticalRiskCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      items: [],
    };
  }

  const saleTransactions = (transactions || []).filter(t => t && (t.type === 'Sale' || !t.type));
  const now = Date.now();

  // Index sales by product id and SKU
  const productSaleStats = new Map<
    string,
    {
      totalUnits: number;
      units30Days: number;
      units60Days: number;
      latestSaleTs: number | null;
    }
  >();

  for (const t of saleTransactions) {
    const rawDate = t.transactionDate || t.createdAt;
    const ts = parseDateTimestamp(rawDate) || now;
    const qty = Math.max(1, Number(t.quantity) || 1);
    const ageDays = (now - ts) / MS_PER_DAY;

    const keys = [
      String(t.productId || '').toLowerCase(),
      String(t.sku || '').trim().toLowerCase(),
      String(t.productName || '').trim().toLowerCase(),
    ].filter(k => k.length > 0);

    for (const k of keys) {
      const stat = productSaleStats.get(k) || {
        totalUnits: 0,
        units30Days: 0,
        units60Days: 0,
        latestSaleTs: null,
      };
      stat.totalUnits += qty;
      if (ageDays <= 30) stat.units30Days += qty;
      if (ageDays <= 60) stat.units60Days += qty;
      if (stat.latestSaleTs === null || ts > stat.latestSaleTs) {
        stat.latestSaleTs = ts;
      }
      productSaleStats.set(k, stat);
    }
  }

  const items: DeadStockAnalysisItem[] = [];

  for (const p of products) {
    const stock = Math.max(0, typeof p.stock === 'number' ? p.stock : 0);
    if (stock <= 0) continue; // Out of stock is reorder territory, not dead stock

    const pPrice = Math.max(1, typeof p.price === 'number' ? p.price : 500);
    const hasCostPrice = typeof p.costPrice === 'number' && p.costPrice > 0;
    const effectiveCost = hasCostPrice ? p.costPrice! : Math.round(pPrice * 0.6);
    const tiedCapital = Math.round(stock * effectiveCost);

    // Lookup sales stats
    const pId = String(p.id || '').toLowerCase();
    const pSku = String(p.sku || '').trim().toLowerCase();
    const pName = String(p.name || p.productName || '').trim().toLowerCase();

    const stats =
      productSaleStats.get(pId) ||
      (pSku ? productSaleStats.get(pSku) : null) ||
      (pName ? productSaleStats.get(pName) : null) || {
        totalUnits: 0,
        units30Days: 0,
        units60Days: 0,
        latestSaleTs: null,
      };

    const daysSinceLastSale = stats.latestSaleTs ? Math.max(0, Math.round((now - stats.latestSaleTs) / MS_PER_DAY)) : null;

    let productAgeDays = 60; // Default reasonable baseline if not recorded
    if (p.createdAt) {
      const cTs = parseDateTimestamp(p.createdAt);
      if (cTs) productAgeDays = Math.max(1, Math.round((now - cTs) / MS_PER_DAY));
    }

    const velocity30 = stats.units30Days / 30;
    const dailyVelocity = parseFloat(velocity30.toFixed(2));

    // Inventory coverage calculation (days of stock remaining at current velocity)
    const stockCoverageDays = dailyVelocity > 0
      ? Math.round(stock / dailyVelocity)
      : (daysSinceLastSale !== null ? Math.max(daysSinceLastSale * 4, 365) : 365);

    // Multi-factor Risk Level Classification
    let riskLevel: DeadStockRiskLevel = 'LOW';
    let urgencyScore = 20;

    const isCompletelyZeroSales = stats.totalUnits === 0 && productAgeDays >= 28;
    const isZeroRecentSales = stats.units30Days === 0 && (daysSinceLastSale === null || daysSinceLastSale >= 30);

    if (stock >= 15 && (isCompletelyZeroSales || (daysSinceLastSale !== null && daysSinceLastSale >= 60)) && stockCoverageDays >= 365) {
      riskLevel = 'CRITICAL';
      urgencyScore = 95;
    } else if (stockCoverageDays >= 180 || (isZeroRecentSales && stock >= 10)) {
      riskLevel = 'HIGH';
      urgencyScore = 75;
    } else if (stockCoverageDays >= 90 || stats.units30Days <= 2) {
      riskLevel = 'MEDIUM';
      urgencyScore = 50;
    } else {
      riskLevel = 'LOW';
      urgencyScore = 25;
    }

    // Recommended discount percent
    let recommendedDiscountPercent = 15;
    if (riskLevel === 'CRITICAL') recommendedDiscountPercent = 25;
    else if (riskLevel === 'HIGH') recommendedDiscountPercent = 20;
    else if (riskLevel === 'MEDIUM') recommendedDiscountPercent = 15;
    else recommendedDiscountPercent = 10;

    const recommendedNewPrice = Math.round(pPrice * (1 - recommendedDiscountPercent / 100));
    const estimatedCashUnlocked = Math.round(stock * recommendedNewPrice);

    // Construct human-friendly explanation (Section 17)
    let whyExplanation = '';
    const nameLabel = p.name || p.productName || 'Product';

    if (isCompletelyZeroSales) {
      whyExplanation = `No sales recorded since added ${productAgeDays} days ago while ${stock} units remain in inventory (~${stockCoverageDays} days coverage).`;
    } else if (stats.units30Days === 0) {
      whyExplanation = `Zero units sold in the last 30 days (last sale was ${daysSinceLastSale || 30} days ago) with ${stock} units tied up in warehouse.`;
    } else {
      const coverageMonths = Math.max(1, Math.round(stockCoverageDays / 30));
      whyExplanation = `Sales velocity is ${dailyVelocity}/day (${stats.units30Days} units sold in past 30 days) while ${stock} units remain in stock. At current sales rate, inventory coverage is approximately ${coverageMonths} months.`;
    }

    if (!hasCostPrice) {
      whyExplanation += ' (Margin impact cannot be estimated because product cost data is unavailable.)';
    }

    const recommendedAction = hasCostPrice
      ? `Launch a ${recommendedDiscountPercent}% clearance discount to recover ₹${estimatedCashUnlocked.toLocaleString('en-IN')} in working capital.`
      : `Test a ${recommendedDiscountPercent}% promotional test to accelerate sell-through and free storage capacity.`;

    items.push({
      product: p,
      productId: p.id,
      productName: nameLabel,
      sku: p.sku || 'N/A',
      currentStock: stock,
      price: pPrice,
      costPrice: p.costPrice,
      hasCostPrice,
      tiedUpCapital: tiedCapital,
      totalUnitsSold: stats.totalUnits,
      salesLast30Days: stats.units30Days,
      salesLast60Days: stats.units60Days,
      dailyVelocity,
      daysSinceLastSale,
      stockCoverageDays,
      productAgeDays,
      riskLevel,
      urgencyScore,
      recommendedDiscountPercent,
      recommendedNewPrice,
      estimatedCashUnlocked,
      whyExplanation,
      recommendedAction,
    });
  }

  // Sort by urgency score descending
  items.sort((a, b) => b.urgencyScore - a.urgencyScore || b.tiedUpCapital - a.tiedUpCapital);

  const totalDeadCapital = items
    .filter(item => item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH')
    .reduce((acc, item) => acc + item.tiedUpCapital, 0);

  return {
    totalDeadCapital,
    criticalRiskCount: items.filter(i => i.riskLevel === 'CRITICAL').length,
    highRiskCount: items.filter(i => i.riskLevel === 'HIGH').length,
    mediumRiskCount: items.filter(i => i.riskLevel === 'MEDIUM').length,
    lowRiskCount: items.filter(i => i.riskLevel === 'LOW').length,
    items,
  };
}
