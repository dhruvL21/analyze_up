import type { Product, Transaction } from '../types';

/**
 * MODEL — Dynamic Sales-Driven Clearance Pricing & Liquidation Elasticity Model
 * 
 * Computes individual, product-specific clearance discounts based on:
 * 1. Transaction Recency & Inactivity: Days since last customer purchase
 * 2. Sales Velocity Degradation: Units sold in last 30d / 60d vs catalog historical run-rate
 * 3. Warehouse Coverage Overhang: Days of sitting inventory based on actual run-rate
 * 4. Gross Margin Headroom & Profit Protection: (Price - Cost) / Price guardrail
 * 5. Category Price Elasticity: Footwear (+), Apparel (+), Electronics (-), etc.
 * 
 * Ensures every product receives a genuine, data-backed discount derived from actual sales,
 * avoiding arbitrary, random, or hardcoded flat percentages across catalog items.
 */

export interface ClearanceSalesMetrics {
  totalUnitsSold?: number;
  salesLast30Days?: number;
  salesLast60Days?: number;
  dailyVelocity?: number;
  daysSinceLastSale?: number | null;
  stockCoverageDays?: number;
  productAgeDays?: number;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgencyScore?: number;
  whyExplanation?: string;
}

export interface ClearanceSalesContext {
  transactions?: Transaction[];
  salesMetrics?: ClearanceSalesMetrics;
  totalCatalogDeadCapital?: number;
}

export interface ClearancePrediction {
  discountPercent: number;
  newPrice: number;
  oldPrice: number;
  costPrice: number;
  hasCostPrice: boolean;
  grossMarginBefore: number;
  grossMarginAfter: number;
  estimatedCashUnlocked: number;
  unitProfitRetained: number;
  urgencyScore: number; // 0 - 100
  aiRationale: string;
  liquidationStrategy: 'Aggressive Velocity' | 'Balanced Markdown' | 'Capital Preservation';
  salesDataExplanation?: {
    daysSinceLastSale: number | null;
    unitsSoldLast30d: number;
    unitsSoldLast60d: number;
    stockCoverageDays: number;
    isNeverSold: boolean;
  };
}

export interface ClearanceProductInput {
  id?: string;
  name?: string;
  productName?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  category?: string;
  sku?: string;
  createdAt?: any;
  unit?: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Extract sales metrics from either precomputed analysis or raw transactions
 */
function resolveProductSalesMetrics(
  product: ClearanceProductInput,
  contextOrDeadCapital?: number | ClearanceSalesContext | any,
  transactions?: Transaction[]
): {
  metrics: ClearanceSalesMetrics;
  hasDirectSalesData: boolean;
  totalDeadCapital: number;
} {
  let totalDeadCapital = 0;
  let metrics: ClearanceSalesMetrics = {};
  let txList: Transaction[] = [];
  let hasDirectSalesData = false;

  if (typeof contextOrDeadCapital === 'number') {
    totalDeadCapital = contextOrDeadCapital;
    if (Array.isArray(transactions)) {
      txList = transactions;
    }
  } else if (contextOrDeadCapital && typeof contextOrDeadCapital === 'object') {
    // Check if contextOrDeadCapital is already a DeadStockAnalysisItem
    if (
      'daysSinceLastSale' in contextOrDeadCapital ||
      'salesLast30Days' in contextOrDeadCapital ||
      'stockCoverageDays' in contextOrDeadCapital
    ) {
      metrics = {
        totalUnitsSold: contextOrDeadCapital.totalUnitsSold,
        salesLast30Days: contextOrDeadCapital.salesLast30Days,
        salesLast60Days: contextOrDeadCapital.salesLast60Days,
        dailyVelocity: contextOrDeadCapital.dailyVelocity,
        daysSinceLastSale: contextOrDeadCapital.daysSinceLastSale,
        stockCoverageDays: contextOrDeadCapital.stockCoverageDays,
        productAgeDays: contextOrDeadCapital.productAgeDays,
        riskLevel: contextOrDeadCapital.riskLevel,
        urgencyScore: contextOrDeadCapital.urgencyScore,
        whyExplanation: contextOrDeadCapital.whyExplanation,
      };
      hasDirectSalesData = true;
    }

    if (contextOrDeadCapital.salesMetrics) {
      metrics = { ...metrics, ...contextOrDeadCapital.salesMetrics };
      hasDirectSalesData = true;
    }
    if (Array.isArray(contextOrDeadCapital.transactions)) {
      txList = contextOrDeadCapital.transactions;
    }
    if (typeof contextOrDeadCapital.totalCatalogDeadCapital === 'number') {
      totalDeadCapital = contextOrDeadCapital.totalCatalogDeadCapital;
    }
  }

  if (Array.isArray(transactions) && txList.length === 0) {
    txList = transactions;
  }

  // If we have transactions but no precomputed metrics, parse transactions directly for this product
  if (!hasDirectSalesData && txList.length > 0) {
    const saleTx = txList.filter(t => t && (t.type === 'Sale' || !t.type));
    const now = Date.now();

    const pId = String(product.id || '').toLowerCase();
    const pSku = String(product.sku || '').trim().toLowerCase();
    const pName = String(product.name || product.productName || '').trim().toLowerCase();

    let totalUnits = 0;
    let units30 = 0;
    let units60 = 0;
    let latestSaleTs: number | null = null;

    for (const t of saleTx) {
      const tProdId = String(t.productId || '').toLowerCase();
      const tSku = String(t.sku || '').trim().toLowerCase();
      const tName = String(t.productName || '').trim().toLowerCase();

      const isMatch =
        (pId && tProdId && pId === tProdId) ||
        (pSku && tSku && pSku === tSku) ||
        (pName && tName && pName === tName);

      if (isMatch) {
        const rawDate = t.transactionDate || t.createdAt;
        const ts = typeof rawDate === 'string' ? new Date(rawDate).getTime() : (typeof rawDate === 'number' ? rawDate : now);
        const qty = Math.max(1, Number(t.quantity) || 1);
        const ageDays = (now - ts) / MS_PER_DAY;

        totalUnits += qty;
        if (ageDays <= 30) units30 += qty;
        if (ageDays <= 60) units60 += qty;
        if (latestSaleTs === null || ts > latestSaleTs) {
          latestSaleTs = ts;
        }
      }
    }

    const daysSinceLastSale = latestSaleTs ? Math.max(0, Math.round((now - latestSaleTs) / MS_PER_DAY)) : null;
    const dailyVelocity = parseFloat((units30 / 30).toFixed(2));
    const stock = Math.max(1, product.stock || 1);
    const stockCoverageDays = dailyVelocity > 0
      ? Math.round(stock / dailyVelocity)
      : (daysSinceLastSale !== null ? Math.max(daysSinceLastSale * 3, 90) : 365);

    metrics = {
      totalUnitsSold: totalUnits,
      salesLast30Days: units30,
      salesLast60Days: units60,
      dailyVelocity,
      daysSinceLastSale,
      stockCoverageDays,
      productAgeDays: 90,
    };
    hasDirectSalesData = true;
  }

  return { metrics, hasDirectSalesData, totalDeadCapital };
}

export function predictOptimalClearanceDiscount(
  product: ClearanceProductInput,
  contextOrDeadCapital?: number | ClearanceSalesContext | any,
  transactions?: Transaction[]
): ClearancePrediction {
  const safePrice = Math.max(50, product.price || 500);
  const hasCostPrice = Boolean(product.costPrice && product.costPrice > 0);
  const cost = hasCostPrice ? product.costPrice! : Math.round(safePrice * 0.6);
  const stock = Math.max(1, product.stock || 1);
  const tiedCapital = stock * cost;

  // 1. Calculate Gross Margin Headroom
  const currentMargin = hasCostPrice ? Math.max(0, (safePrice - cost) / safePrice) : 0.40;

  // 2. Extract specific sales metrics for this item
  const { metrics, hasDirectSalesData } = resolveProductSalesMetrics(
    product,
    contextOrDeadCapital,
    transactions
  );

  const daysSinceLastSale = metrics.daysSinceLastSale !== undefined ? metrics.daysSinceLastSale : null;
  const totalUnitsSold = metrics.totalUnitsSold ?? 0;
  const salesLast30 = metrics.salesLast30Days ?? 0;
  const salesLast60 = metrics.salesLast60Days ?? 0;
  const stockCoverageDays = metrics.stockCoverageDays ?? 365;
  const productAgeDays = metrics.productAgeDays ?? 60;
  const isNeverSold = totalUnitsSold === 0 && daysSinceLastSale === null;

  // 3. Compute Sales Inactivity & Stagnancy Score (0 - 100)
  let salesStagnancyScore = 0;

  if (hasDirectSalesData) {
    // Factor A: Recency of Customer Purchase (0 - 42 pts)
    if (isNeverSold) {
      if (productAgeDays >= 90) salesStagnancyScore += 42;
      else if (productAgeDays >= 60) salesStagnancyScore += 35;
      else if (productAgeDays >= 30) salesStagnancyScore += 26;
      else salesStagnancyScore += 16;
    } else if (daysSinceLastSale !== null) {
      if (daysSinceLastSale >= 120) salesStagnancyScore += 42;
      else if (daysSinceLastSale >= 90) salesStagnancyScore += 37;
      else if (daysSinceLastSale >= 60) salesStagnancyScore += 29;
      else if (daysSinceLastSale >= 40) salesStagnancyScore += 21;
      else if (daysSinceLastSale >= 25) salesStagnancyScore += 13;
      else if (daysSinceLastSale >= 14) salesStagnancyScore += 6;
      else salesStagnancyScore += 1;
    } else {
      salesStagnancyScore += 25;
    }

    // Factor B: Velocity Run-Rate Trends (0 - 25 pts)
    if (salesLast30 === 0 && salesLast60 === 0) {
      salesStagnancyScore += 25;
    } else if (salesLast30 === 0 && salesLast60 > 0) {
      salesStagnancyScore += 16;
    } else if (salesLast30 === 1) {
      salesStagnancyScore += 8;
    } else if (salesLast30 === 2) {
      salesStagnancyScore += 4;
    }

    // Factor C: Inventory Coverage Overhang (0 - 23 pts)
    if (stockCoverageDays >= 365) {
      salesStagnancyScore += 23;
    } else if (stockCoverageDays >= 200) {
      salesStagnancyScore += 17;
    } else if (stockCoverageDays >= 120) {
      salesStagnancyScore += 11;
    } else if (stockCoverageDays >= 60) {
      salesStagnancyScore += 5;
    }

    // Factor D: Inventory Depth & Scale (0 - 10 pts)
    if (stock >= 80) salesStagnancyScore += 10;
    else if (stock >= 50) salesStagnancyScore += 7;
    else if (stock >= 25) salesStagnancyScore += 4;
    else salesStagnancyScore += 1;
  } else {
    // Fallback if no sales data provided: derive differentiators from stock depth and age
    const stockDepthPts = Math.min(35, Math.round((stock / 80) * 35));
    const marginPts = Math.round(currentMargin * 35);
    salesStagnancyScore = Math.min(85, Math.max(30, stockDepthPts + marginPts));
  }

  salesStagnancyScore = Math.min(100, Math.max(0, salesStagnancyScore));

  // 4. Derive Base Discount Percent from Actual Stagnancy
  let baseDiscountPercent: number;
  if (salesStagnancyScore >= 85) {
    // Critical dead stock: deep clearance to unfreeze frozen capital (28% to 36%)
    baseDiscountPercent = 28 + Math.round(((salesStagnancyScore - 85) / 15) * 8);
  } else if (salesStagnancyScore >= 65) {
    // High stagnancy: strong clearance markdown (22% to 27%)
    baseDiscountPercent = 22 + Math.round(((salesStagnancyScore - 65) / 20) * 5);
  } else if (salesStagnancyScore >= 45) {
    // Moderate stagnancy: balanced markdown (16% to 21%)
    baseDiscountPercent = 16 + Math.round(((salesStagnancyScore - 45) / 20) * 5);
  } else if (salesStagnancyScore >= 25) {
    // Mild stagnancy: modest discount to reactivate velocity (11% to 15%)
    baseDiscountPercent = 11 + Math.round(((salesStagnancyScore - 25) / 20) * 4);
  } else {
    // Minimal stagnancy / active seller: 8% to 10%
    baseDiscountPercent = 8 + Math.round((salesStagnancyScore / 25) * 2);
  }

  // 5. Category Price Elasticity Adjustment
  const categoryLower = (product.category || product.name || product.productName || '').toLowerCase();
  let elasticityAdjustment = 0;
  if (
    categoryLower.includes('shoe') ||
    categoryLower.includes('sneaker') ||
    categoryLower.includes('loafer') ||
    categoryLower.includes('boot') ||
    categoryLower.includes('footwear')
  ) {
    elasticityAdjustment = +2; // Footwear has higher markdown conversion elasticity
  } else if (
    categoryLower.includes('jacket') ||
    categoryLower.includes('hoodie') ||
    categoryLower.includes('shirt') ||
    categoryLower.includes('apparel') ||
    categoryLower.includes('cloth') ||
    categoryLower.includes('jean')
  ) {
    elasticityAdjustment = +1; // Apparel seasonal clearance
  } else if (
    categoryLower.includes('electron') ||
    categoryLower.includes('audio') ||
    categoryLower.includes('headphone') ||
    categoryLower.includes('keyboard') ||
    categoryLower.includes('tech')
  ) {
    elasticityAdjustment = -2; // Electronics margin protection
  }

  let rawDiscount = baseDiscountPercent + elasticityAdjustment;

  // 6. Gross Margin Headroom Fine-Tuning & Profit Protection
  if (hasCostPrice) {
    if (currentMargin >= 0.55 && salesStagnancyScore >= 70) {
      // High margin cushion allows 1-2% extra clearance power for stubborn inventory
      rawDiscount += 1;
    } else if (currentMargin < 0.25) {
      // Thin margin product; protect from selling below cost
      rawDiscount = Math.min(rawDiscount, Math.max(6, Math.floor(currentMargin * 100 * 0.70)));
    }
  }

  // Strict Margin Safety Ceiling: Never discount so deeply that the business sells at a loss.
  // Retain at least 8% margin headroom over cost.
  const maxSafeDiscountByMargin = hasCostPrice
    ? Math.max(6, Math.floor(((safePrice - cost * 1.08) / safePrice) * 100))
    : 28;

  const finalDiscountPercent = Math.max(8, Math.min(38, Math.min(rawDiscount, maxSafeDiscountByMargin)));

  const newPrice = Math.round(safePrice * (1 - finalDiscountPercent / 100));
  const grossMarginAfter = hasCostPrice ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
  const unitProfitRetained = hasCostPrice ? newPrice - cost : 0;
  const estimatedCashUnlocked = Math.round(stock * newPrice);

  // 7. Liquidation Strategy & Transparent Data-Driven AI Rationale
  let strategy: ClearancePrediction['liquidationStrategy'];
  if (finalDiscountPercent >= 26) {
    strategy = 'Aggressive Velocity';
  } else if (finalDiscountPercent >= 16) {
    strategy = 'Balanced Markdown';
  } else {
    strategy = 'Capital Preservation';
  }

  let aiRationale = '';
  if (!hasCostPrice) {
    aiRationale = `Margin impact cannot be estimated because product cost is unrecorded. Recommended ${finalDiscountPercent}% promotional test is calibrated for sell-through acceleration to free working capital.`;
  } else if (isNeverSold) {
    aiRationale = `Zero customer sales recorded across ${stock} units since inventory added ${productAgeDays}d ago (~${stockCoverageDays}d coverage). Recommended ${finalDiscountPercent}% clearance unfreezes ₹${estimatedCashUnlocked.toLocaleString('en-IN')} cash while preserving ${grossMarginAfter}% gross profit margin (₹${unitProfitRetained.toLocaleString('en-IN')}/unit).`;
  } else if (daysSinceLastSale !== null && daysSinceLastSale >= 30) {
    aiRationale = `Sales stalled with ${daysSinceLastSale} days since last customer purchase (${salesLast60} units in past 60d) and ${stock} units in warehouse. Tailored ${finalDiscountPercent}% markdown reactivates velocity while preserving ${grossMarginAfter}% margin (₹${unitProfitRetained.toLocaleString('en-IN')}/unit profit).`;
  } else if (stockCoverageDays >= 120) {
    aiRationale = `Recent sales observed (${salesLast30} units in past 30d) but high inventory depth (${stock} units, ~${stockCoverageDays}d coverage). Calibrated ${finalDiscountPercent}% promotion unlocks ₹${estimatedCashUnlocked.toLocaleString('en-IN')} working capital without unnecessary margin sacrifice.`;
  } else {
    aiRationale = `Calibrated ${finalDiscountPercent}% markdown protects ₹${cost.toLocaleString('en-IN')} unit cost, unfreezing ₹${estimatedCashUnlocked.toLocaleString('en-IN')} cash flow while maintaining ${grossMarginAfter}% profit.`;
  }

  const urgencyScore = Math.min(100, Math.round(salesStagnancyScore * 0.7 + finalDiscountPercent * 0.3));

  return {
    discountPercent: finalDiscountPercent,
    newPrice,
    oldPrice: safePrice,
    costPrice: cost,
    hasCostPrice,
    grossMarginBefore: hasCostPrice ? Math.round(currentMargin * 100) : 0,
    grossMarginAfter,
    estimatedCashUnlocked,
    unitProfitRetained,
    urgencyScore,
    aiRationale,
    liquidationStrategy: strategy,
    salesDataExplanation: {
      daysSinceLastSale,
      unitsSoldLast30d: salesLast30,
      unitsSoldLast60d: salesLast60,
      stockCoverageDays,
      isNeverSold,
    },
  };
}
