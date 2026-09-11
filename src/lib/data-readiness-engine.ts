import type { Product, Transaction, BusinessProfile } from './types';

export type IntelligenceLevel = 'LEARNING' | 'EARLY_INSIGHTS' | 'PREDICTIVE' | 'OPTIMIZATION';

export interface DataQualityReport {
  score: number; // 0 - 15 points
  percentage: number; // 0 - 100%
  totalRecordsChecked: number;
  anomaliesFound: number;
  missingSkuCount: number;
  missingPriceCount: number;
  missingCostCount: number;
  missingQuantityCount: number;
  invalidDateCount: number;
  duplicateOrderCount: number;
  negativeQuantityCount: number;
  warnings: string[];
}

export interface IntelligenceCapabilities {
  basicAnalytics: boolean;
  trendAnalysis: boolean;
  inventoryInsights: boolean;
  slowMoverDetection: boolean;
  deadStockDetection: boolean;
  demandForecasting: boolean;
  stockoutPrediction: boolean;
  reorderRecommendations: boolean;
  discountRecommendations: boolean;
  seasonalityAnalysis: boolean;
  revenueOptimization: boolean;
  whatIfAnalysis: boolean;

  // Canonical and convenient aliases
  baselineSalesAnalytics: boolean;
  marginAnalysis: boolean;
  clearancePricing: boolean;
  safetyStockCalculation: boolean;
  seasonalityDetection: boolean;
  advancedCohortLTV: boolean;
  dynamicSafetyStock: boolean;
}

export interface DataReadiness {
  score: number; // 0 - 100
  level: IntelligenceLevel;

  historicalDays: number;
  daysOfHistory?: number;
  meaningfulSalesDays: number;
  totalOrders: number;
  totalProducts: number;
  totalUnitsSold: number;
  averageOrdersPerDay: number;

  hasInventoryData: boolean;
  hasHistoricalInventory: boolean;
  hasPricingHistory: boolean;
  hasPromotionHistory: boolean;
  hasCostData: boolean;

  // Component breakdown (Sum = score)
  historicalCoverageScore: number; // Max 25
  transactionDensityScore: number; // Max 20
  productCoverageScore: number; // Max 10
  inventoryScore: number; // Max 15
  dataQualityScore: number; // Max 15
  pricingPromotionScore: number; // Max 5
  seasonalityScore: number; // Max 10

  qualityReport: DataQualityReport;

  // Granular eligibility flags
  forecastingEligible: boolean;
  deadStockEligible: boolean;
  stockoutEligible: boolean;
  discountRecommendationEligible: boolean;
  seasonalityEligible: boolean;
  profitOptimizationEligible: boolean;

  limitations: string[];
  reasons: string[];
  capabilities: IntelligenceCapabilities;

  // Resilience state
  isResiliencePreserved?: boolean;
}

export interface EvaluateReadinessOptions {
  profile?: BusinessProfile | null;
  previousReadiness?: DataReadiness | null;
  previousSnapshot?: DataReadiness | null;
  isSyncError?: boolean;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Safely parses any date representation (string, timestamp object, or Date)
 */
export function parseDateTimestamp(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? null : t;
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val && typeof (val as any).seconds === 'number') {
    return (val as any).seconds * 1000;
  }
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    return isNaN(t) || t <= 0 ? null : t;
  }
  return null;
}

/**
 * Evaluates Data Quality across products and transactions
 */
export function evaluateDataQuality(
  products: Product[] = [],
  transactions: Transaction[] = []
): DataQualityReport {
  let missingSkuCount = 0;
  let missingPriceCount = 0;
  let missingCostCount = 0;
  let missingQuantityCount = 0;
  let invalidDateCount = 0;
  let negativeQuantityCount = 0;
  const warnings: string[] = [];

  const seenTxIds = new Set<string>();
  let duplicateOrderCount = 0;

  for (const p of products) {
    if (!p.sku || p.sku.trim() === '' || p.sku === 'N/A') missingSkuCount++;
    if (typeof p.price !== 'number' || isNaN(p.price) || p.price <= 0) missingPriceCount++;
    if (typeof p.costPrice !== 'number' || isNaN(p.costPrice) || p.costPrice <= 0) missingCostCount++;
  }

  for (const t of transactions) {
    const rawDate = t.transactionDate || (typeof t.createdAt === 'string' ? t.createdAt : '');
    const ts = parseDateTimestamp(rawDate);
    if (!ts) invalidDateCount++;

    const qty = Number(t.quantity);
    if (isNaN(qty) || qty === 0) missingQuantityCount++;
    else if (qty < 0) negativeQuantityCount++;

    if (t.id) {
      if (seenTxIds.has(t.id)) duplicateOrderCount++;
      else seenTxIds.add(t.id);
    }
  }

  const totalRecords = products.length + transactions.length;
  let penalties = 0;

  if (totalRecords === 0) {
    return {
      score: 0,
      percentage: 0,
      totalRecordsChecked: 0,
      anomaliesFound: 0,
      missingSkuCount: 0,
      missingPriceCount: 0,
      missingCostCount: 0,
      missingQuantityCount: 0,
      invalidDateCount: 0,
      negativeQuantityCount: 0,
      duplicateOrderCount: 0,
      warnings: ['No products or transactions loaded in catalog.'],
    };
  }

  if (products.length > 0) {
    const missingSkuRatio = missingSkuCount / products.length;
    if (missingSkuRatio > 0.5) {
      penalties += 3;
      warnings.push('Over 50% of products lack unique SKUs.');
    } else if (missingSkuRatio > 0.2) {
      penalties += 1.5;
      warnings.push('Some catalog products are missing SKU identifiers.');
    }

    const missingPriceRatio = missingPriceCount / products.length;
    if (missingPriceRatio > 0.2) {
      penalties += 3;
      warnings.push('Products found with missing or invalid retail prices.');
    }

    const missingCostRatio = missingCostCount / products.length;
    if (missingCostRatio > 0.6) {
      // Not an anomaly penalty, but a capability limitation
      warnings.push('Product cost/margin data is limited. Profit-based optimizations are restricted.');
    }
  }

  if (transactions.length > 0) {
    if (invalidDateCount > 0) {
      const invRatio = invalidDateCount / transactions.length;
      penalties += invRatio > 0.1 ? 4 : 2;
      warnings.push(`${invalidDateCount} transaction(s) have unparseable or missing timestamps.`);
    }

    if (negativeQuantityCount > 0) {
      penalties += 2;
      warnings.push('Transactions found with negative unit quantities.');
    }

    if (duplicateOrderCount > 0) {
      penalties += 2;
      warnings.push(`${duplicateOrderCount} duplicate transaction identifier(s) detected.`);
    }
  }

  const rawQualityScore = Math.max(0, 15 - penalties);
  const qualityScore = Math.round(rawQualityScore * 10) / 10;
  const percentage = Math.round((qualityScore / 15) * 100);

  return {
    score: qualityScore,
    percentage,
    totalRecordsChecked: totalRecords,
    anomaliesFound: Math.round(penalties),
    missingSkuCount,
    missingPriceCount,
    missingCostCount,
    missingQuantityCount,
    invalidDateCount,
    duplicateOrderCount,
    negativeQuantityCount,
    warnings,
  };
}

/**
 * Evaluates the full Data Readiness Score (0-100) and Intelligence Level
 */
export function evaluateDataReadiness(
  products: Product[] = [],
  transactions: Transaction[] = [],
  options: EvaluateReadinessOptions = {}
): DataReadiness {
  const prev = options.previousReadiness || options.previousSnapshot;
  const { isSyncError } = options;

  // SECTION 23: Temporary sync failure resilience
  // If sync error occurred or transactions are temporarily empty while previously having an established score, preserve maturity.
  if (
    isSyncError ||
    (transactions.length === 0 && prev && prev.score >= 40)
  ) {
    if (prev) {
      return {
        ...prev,
        isResiliencePreserved: true,
        limitations: [
          ...prev.limitations.filter(l => !l.includes('Temporary sync')),
          '⚠️ Temporary sync interruption detected. Established data maturity preserved from previous confirmed sync.',
        ],
        reasons: [
          ...prev.reasons,
          'Preserved data readiness score and capabilities during temporary sync interruption.',
        ],
      };
    }
  }

  const saleTransactions = (transactions || []).filter(t => t && (t.type === 'Sale' || !t.type));
  const qualityReport = evaluateDataQuality(products, transactions);

  // 1. Historical Coverage Calculation
  const validTimestamps = saleTransactions
    .map(t => parseDateTimestamp(t.transactionDate || t.createdAt))
    .filter((ts): ts is number => ts !== null && ts > 0);

  let historicalDays = 0;
  const salesDaySet = new Set<string>();

  if (validTimestamps.length > 0) {
    const minTs = Math.min(...validTimestamps);
    const maxTs = Math.max(...validTimestamps);
    const span = Math.max(1, Math.round((maxTs - minTs) / MS_PER_DAY) + 1);
    historicalDays = span;

    for (const ts of validTimestamps) {
      salesDaySet.add(new Date(ts).toISOString().split('T')[0]);
    }
  }

  const meaningfulSalesDays = salesDaySet.size;

  // Component 1: Historical Coverage (Max 25 pts)
  let historicalCoverageScore = 0;
  if (historicalDays >= 120) historicalCoverageScore = 25;
  else if (historicalDays >= 90) historicalCoverageScore = 22;
  else if (historicalDays >= 60) historicalCoverageScore = 19;
  else if (historicalDays >= 45) historicalCoverageScore = 16;
  else if (historicalDays >= 30) historicalCoverageScore = 13;
  else if (historicalDays >= 15) historicalCoverageScore = 9;
  else if (historicalDays >= 7) historicalCoverageScore = 5;
  else if (historicalDays > 0) historicalCoverageScore = 2;

  // Penalty for fragmented history: if history spans many days but has few active sales days (Scenario 5)
  if (historicalDays >= 14) {
    const continuityRatio = meaningfulSalesDays / Math.max(1, historicalDays);
    if (continuityRatio < 0.1) {
      // Very sparse / low-velocity store across a long period
      historicalCoverageScore = Math.max(1, Math.round(historicalCoverageScore * 0.12));
    } else if (continuityRatio < 0.25) {
      historicalCoverageScore = Math.round(historicalCoverageScore * 0.4);
    }
  }

  // Component 2: Transaction Volume & Density (Max 20 pts)
  const totalOrders = saleTransactions.length;
  const totalUnitsSold = saleTransactions.reduce((acc, t) => acc + Math.max(1, Number(t.quantity) || 1), 0);
  const averageOrdersPerDay = historicalDays > 0 ? parseFloat((totalOrders / historicalDays).toFixed(2)) : 0;

  let transactionDensityScore = 0;
  if (totalOrders >= 5000) transactionDensityScore = 20;
  else if (totalOrders >= 2000) transactionDensityScore = 18;
  else if (totalOrders >= 1000) transactionDensityScore = 16;
  else if (totalOrders >= 500) transactionDensityScore = 14;
  else if (totalOrders >= 250) transactionDensityScore = 11;
  else if (totalOrders >= 100) transactionDensityScore = 8;
  else if (totalOrders >= 40) transactionDensityScore = 5;
  else if (totalOrders >= 15) transactionDensityScore = 3;
  else if (totalOrders > 0) transactionDensityScore = 1;

  // High-volume density bonus (Scenario 6: 20 days but 5,000 orders)
  if (averageOrdersPerDay >= 25 && totalOrders >= 500 && transactionDensityScore < 20) {
    transactionDensityScore = Math.min(20, transactionDensityScore + 3);
  }

  // Component 3: Product Coverage (Max 10 pts)
  const totalProducts = products.length;
  let productCoverageScore = 0;
  if (totalProducts >= 50) productCoverageScore += 5;
  else if (totalProducts >= 20) productCoverageScore += 4;
  else if (totalProducts >= 5) productCoverageScore += 3;
  else if (totalProducts > 0) productCoverageScore += 1;

  // Check product sales coverage (% of products with at least 1 sale)
  if (totalProducts > 0 && totalOrders > 0) {
    const soldProductIds = new Set(saleTransactions.map(t => String(t.productId || t.sku || '').toLowerCase()));
    const soldCount = products.filter(p => soldProductIds.has(String(p.id).toLowerCase()) || (p.sku && soldProductIds.has(p.sku.toLowerCase()))).length;
    const coverageRatio = soldCount / totalProducts;
    if (coverageRatio >= 0.5) productCoverageScore += 5;
    else if (coverageRatio >= 0.25) productCoverageScore += 3;
    else productCoverageScore += 1;
  }
  productCoverageScore = Math.min(10, productCoverageScore);

  // Component 4: Inventory Data (Max 15 pts)
  const totalStock = products.reduce((acc, p) => acc + (typeof p.stock === 'number' ? p.stock : 0), 0);
  const hasInventoryData = products.length > 0 && products.some(p => typeof p.stock === 'number' && p.stock >= 0) && totalStock > 0;
  let inventoryScore = 0;
  if (hasInventoryData) {
    inventoryScore += 10;
    const hasReorderThresholds = products.some(p => typeof p.minStock === 'number' && p.minStock > 0);
    const hasLeadTimes = products.some(p => typeof p.leadTimeDays === 'number' && p.leadTimeDays > 0);
    if (hasReorderThresholds) inventoryScore += 3;
    if (hasLeadTimes) inventoryScore += 2;
  }
  inventoryScore = Math.min(15, inventoryScore);

  // Component 5: Data Quality (Max 15 pts)
  const dataQualityScore = qualityReport.score;

  // Component 6: Pricing / Promotion History (Max 5 pts)
  const hasPricingHistory = products.some(p => typeof p.price === 'number' && p.price > 0);
  const hasPromotionHistory = products.some(p => (p.compareAtPrice && p.compareAtPrice > p.price) || (p.discountPercent && p.discountPercent > 0));
  const hasCostData = products.some(p => typeof p.costPrice === 'number' && p.costPrice > 0);
  let pricingPromotionScore = 0;
  if (hasPricingHistory) pricingPromotionScore += 2;
  if (hasCostData) pricingPromotionScore += 2;
  if (hasPromotionHistory) pricingPromotionScore += 1;
  pricingPromotionScore = Math.min(5, pricingPromotionScore);

  // Component 7: Seasonality Coverage (Max 10 pts)
  let seasonalityScore = 0;
  if (historicalDays >= 365 && meaningfulSalesDays >= 120) seasonalityScore = 10;
  else if (historicalDays >= 180 && meaningfulSalesDays >= 75) seasonalityScore = 7;
  else if (historicalDays >= 90 && meaningfulSalesDays >= 45) seasonalityScore = 4;
  else seasonalityScore = 0; // Strict rule: No seasonality score under 90 days

  // Overall Score Calculation (0-100)
  let totalScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        historicalCoverageScore +
        transactionDensityScore +
        productCoverageScore +
        inventoryScore +
        dataQualityScore +
        pricingPromotionScore +
        seasonalityScore
      )
    )
  );

  // Level 1 Learning boundary: New store with under 10 days of history and < 100 orders stays <= 40
  if (historicalDays < 10 && totalOrders < 100) {
    totalScore = Math.min(40, totalScore);
  }

  // Low volume boundary: under 40 orders across any time span cannot reach predictive thresholds
  if (totalOrders < 40) {
    totalScore = Math.min(45, totalScore);
  }

  // Level Determination
  let level: IntelligenceLevel = 'LEARNING';
  if (totalScore >= 85 && historicalDays >= 120 && totalOrders >= 1500) {
    level = 'OPTIMIZATION';
  } else if (
    totalScore >= 65 &&
    (
      (historicalDays >= 40 && totalOrders >= 400) ||
      (totalOrders >= 1500 && historicalDays >= 15) // High-volume new store exception
    )
  ) {
    level = 'PREDICTIVE';
  } else if (
    totalScore >= 40 &&
    (
      (historicalDays >= 14 && totalOrders >= 80 && meaningfulSalesDays >= 8) ||
      totalOrders >= 200
    )
  ) {
    level = 'EARLY_INSIGHTS';
  } else {
    level = 'LEARNING';
  }

  // Feature Capabilities
  const capabilities: IntelligenceCapabilities = {
    basicAnalytics: products.length > 0 || totalOrders > 0,
    baselineSalesAnalytics: products.length > 0 || totalOrders > 0,
    inventoryInsights: hasInventoryData,
    trendAnalysis: (historicalDays >= 7 && totalOrders >= 15) || totalOrders >= 50,
    slowMoverDetection: hasInventoryData && ((historicalDays >= 7 && totalOrders >= 15) || totalOrders >= 40),
    stockoutPrediction: hasInventoryData && ((historicalDays >= 7 && totalOrders >= 15) || totalOrders >= 50),
    safetyStockCalculation: hasInventoryData && ((historicalDays >= 14 && totalOrders >= 30) || totalOrders >= 60),
    reorderRecommendations: hasInventoryData && (products.some(p => p.stock <= (p.minStock || 5)) || historicalDays >= 7),
    deadStockDetection: hasInventoryData && ((historicalDays >= 14 && totalOrders >= 25) || totalOrders >= 60),
    demandForecasting: (historicalDays >= 30 && totalOrders >= 80) || (totalOrders >= 400 && historicalDays >= 14),
    discountRecommendations: hasInventoryData && ((historicalDays >= 25 && totalOrders >= 50) || (totalOrders >= 300 && historicalDays >= 14)),
    clearancePricing: hasInventoryData && ((historicalDays >= 25 && totalOrders >= 50) || (totalOrders >= 300 && historicalDays >= 14)),
    marginAnalysis: hasCostData,
    seasonalityAnalysis: historicalDays >= 90 && meaningfulSalesDays >= 45 && totalOrders >= 300,
    seasonalityDetection: historicalDays >= 90 && meaningfulSalesDays >= 45 && totalOrders >= 300,
    revenueOptimization: (historicalDays >= 30 && totalOrders >= 100) || totalOrders >= 500,
    whatIfAnalysis: (historicalDays >= 30 && totalOrders >= 100) || totalOrders >= 500,
    dynamicSafetyStock: level === 'OPTIMIZATION',
    advancedCohortLTV: level === 'OPTIMIZATION',
  };

  // Limitations & Explanatory Reasons
  const limitations: string[] = [];
  const reasons: string[] = [];

  if (totalProducts === 0 && totalOrders === 0) {
    reasons.push("No catalog products or orders loaded yet. Connect your store or import CSV data to begin tracking business intelligence.");
    limitations.push("Import products and sales to calibrate baseline data readiness and unlock analytics.");
  } else if (level === 'LEARNING') {
    reasons.push(`AnalyzeUp currently has ${historicalDays} days and ${totalOrders} orders of recorded activity.`);
    reasons.push("We're monitoring your sales velocity and inventory patterns as early baselines accumulate.");
    limitations.push("Forecasting and predictive models unlock as more sales history accumulates (~30 days baseline or ~300 orders).");
  } else if (level === 'EARLY_INSIGHTS') {
    reasons.push(`${historicalDays} days of sales patterns observed across ${totalOrders} customer orders.`);
    reasons.push('Early velocity trends, stock turnover rates, and fast/slow movers are active.');
    limitations.push('Demand forecasting is currently presented as early estimates with moderate confidence.');
  } else if (level === 'PREDICTIVE') {
    reasons.push(`Robust historical dataset of ${historicalDays} days and ${totalOrders} orders identified.`);
    reasons.push('High-confidence demand forecasting, stockout runway, and dead stock liquidation active.');
  } else {
    reasons.push(`Mature business history with ${historicalDays} days of continuous records and ${totalOrders} transactions.`);
    reasons.push('Full optimization engine active, including seasonality detection and margin expansion.');
  }

  if (!hasInventoryData) {
    limitations.push('⚠️ Warehouse stock data is unavailable. Inventory and stockout predictions are restricted.');
  }

  if (!hasCostData) {
    limitations.push('⚠️ Product cost/margin data is unavailable. Discount opportunities are focused on sell-through acceleration rather than profit optimization.');
  }

  if (!capabilities.seasonalityAnalysis) {
    limitations.push('ℹ️ Seasonality detection requires 90+ days of sales records across continuous cycles.');
  }

  return {
    score: totalScore,
    level,
    historicalDays,
    daysOfHistory: historicalDays,
    meaningfulSalesDays,
    totalOrders,
    totalProducts,
    totalUnitsSold,
    averageOrdersPerDay,
    hasInventoryData,
    hasHistoricalInventory: hasInventoryData && totalOrders > 10,
    hasPricingHistory,
    hasPromotionHistory,
    hasCostData,
    historicalCoverageScore,
    transactionDensityScore,
    productCoverageScore,
    inventoryScore,
    dataQualityScore,
    pricingPromotionScore,
    seasonalityScore,
    qualityReport,
    forecastingEligible: capabilities.demandForecasting,
    deadStockEligible: capabilities.deadStockDetection,
    stockoutEligible: capabilities.stockoutPrediction,
    discountRecommendationEligible: capabilities.discountRecommendations,
    seasonalityEligible: capabilities.seasonalityAnalysis,
    profitOptimizationEligible: capabilities.revenueOptimization && hasCostData,
    limitations,
    reasons,
    capabilities,
  };
}
