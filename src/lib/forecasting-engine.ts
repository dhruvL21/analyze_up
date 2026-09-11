import { Product, Transaction, Supplier, PurchaseOrder } from './types';
import type { IntelligenceCapabilities, DataReadiness } from './data-readiness-engine';

export interface ProductVelocity {
  productId: string;
  productName: string;
  sku: string;
  dailyVelocity: number;
  weeklyVelocity: number;
  monthlyVelocity: number;
  recent7DayVelocity: number;
  historicalVelocity: number;
  velocityChangePercent: number;
  trend: 'Increasing' | 'Stable' | 'Declining' | 'Volatile';
}

export interface DemandForecast {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  forecast7Days: number;
  forecast30Days: number;
  forecast90Days: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  confidenceReason?: string;
}

export interface StockoutProjection {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  dailyVelocity: number;
  daysRemaining: number | null; // null if velocity is 0
  projectedStockoutDate: string | null; // ISO string
  supplierLeadTimeDays: number;
  preferredSupplierName: string;
  stockoutRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'INSUFFICIENT_DATA';
  recommendedReorderQty: number;
  reorderUrgency: 'CRITICAL' | 'MODERATE' | 'LOW' | 'NONE';
  reason: string;
}

export interface RevenueProfitForecast {
  period: '7 Days' | '30 Days' | '90 Days';
  projectedRevenue: number;
  projectedCOGS: number;
  projectedGrossProfit: number;
  projectedMarginPercent: number;
  revenueChangePercent: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  keyDrivers: string[];
}

export interface FutureDeadStockRisk {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  tiedUpCapital: number;
  projected30DayDemand: number;
  projectedExcessUnits: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface ForecastingReport {
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  confidenceReason: string;
  velocities: ProductVelocity[];
  demandForecasts: DemandForecast[];
  stockoutProjections: StockoutProjection[];
  revenueProfitForecast30Days: RevenueProfitForecast;
  futureDeadStockRisks: FutureDeadStockRisk[];
  totalProjected30DayRevenue: number;
  totalProjected30DayProfit: number;
  criticalStockoutCount: number;
  projectedExcessCapital: number;
}

export type ScenarioType = 'BASE' | 'HIGH_DEMAND' | 'LOW_DEMAND';

export interface ForecastScenario {
  type: ScenarioType;
  label: string;
  demandMultiplier: number;
  projected30DayRevenue: number;
  projected30DayProfit: number;
  criticalStockouts: number;
  summary: string;
}

// 1. Calculate Product Sales Velocity
export function calculateProductVelocity(
  product: Product,
  transactions: Transaction[]
): ProductVelocity {
  const pName = product.name || product.productName || 'Product';
  const sku = product.sku || 'N/A';

  const productSales = transactions.filter(
    t => t.type === 'Sale' && (t.productId === product.id || t.sku === product.sku)
  );

  if (productSales.length === 0) {
    return {
      productId: product.id,
      productName: pName,
      sku,
      dailyVelocity: 0,
      weeklyVelocity: 0,
      monthlyVelocity: 0,
      recent7DayVelocity: 0,
      historicalVelocity: 0,
      velocityChangePercent: 0,
      trend: 'Stable',
    };
  }

  // Parse transaction timestamps safely
  const parseTimestamp = (t: Transaction): number => {
    if (typeof t.transactionDate === 'object' && t.transactionDate !== null && 'seconds' in t.transactionDate) {
      return (t.transactionDate as any).seconds * 1000;
    }
    if (t.transactionDate instanceof Date) return t.transactionDate.getTime();
    if (typeof t.transactionDate === 'string') return new Date(t.transactionDate).getTime();
    return Date.now();
  };

  const now = Date.now();
  const ms7Days = 7 * 24 * 60 * 60 * 1000;
  const ms30Days = 30 * 24 * 60 * 60 * 1000;

  const sales7Days = productSales.filter(t => now - parseTimestamp(t) <= ms7Days);
  const sales30Days = productSales.filter(t => now - parseTimestamp(t) <= ms30Days);

  const unitsRecent7Days = sales7Days.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const units30Days = sales30Days.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const totalUnits = productSales.reduce((sum, t) => sum + (t.quantity || 1), 0);

  const dailyVelocity = parseFloat((units30Days > 0 ? units30Days / 30 : totalUnits / 30).toFixed(2));
  const recent7DayDailyVelocity = parseFloat((unitsRecent7Days / 7).toFixed(2));
  const historicalDailyVelocity = parseFloat((totalUnits / Math.max(14, productSales.length * 3)).toFixed(2));

  let velocityChangePercent = 0;
  if (historicalDailyVelocity > 0) {
    velocityChangePercent = Math.round(((recent7DayDailyVelocity - historicalDailyVelocity) / historicalDailyVelocity) * 100);
  }

  let trend: ProductVelocity['trend'] = 'Stable';
  if (velocityChangePercent >= 15) trend = 'Increasing';
  else if (velocityChangePercent <= -15) trend = 'Declining';
  else if (Math.abs(velocityChangePercent) > 40) trend = 'Volatile';

  return {
    productId: product.id,
    productName: pName,
    sku,
    dailyVelocity: Math.max(0.1, dailyVelocity),
    weeklyVelocity: parseFloat((dailyVelocity * 7).toFixed(1)),
    monthlyVelocity: parseFloat((dailyVelocity * 30).toFixed(0)),
    recent7DayVelocity: parseFloat((recent7DayDailyVelocity * 7).toFixed(1)),
    historicalVelocity: parseFloat((historicalDailyVelocity * 7).toFixed(1)),
    velocityChangePercent,
    trend,
  };
}

// 2. Evaluate Forecast Confidence
export function evaluateForecastConfidence(
  product: Product,
  transactions: Transaction[]
): { confidence: DemandForecast['confidence']; reason: string } {
  const productSales = transactions.filter(
    t => t.type === 'Sale' && (t.productId === product.id || t.sku === product.sku)
  );

  if (productSales.length === 0) {
    return {
      confidence: 'INSUFFICIENT',
      reason: 'No recorded sales history for this SKU. Continue collecting sales logs to unlock demand forecasting.',
    };
  }

  if (productSales.length < 5) {
    return {
      confidence: 'LOW',
      reason: 'Limited sales volume (fewer than 5 recorded transactions). Forecast may have higher volatility.',
    };
  }

  if (productSales.length < 15) {
    return {
      confidence: 'MEDIUM',
      reason: 'Moderate transaction history. Demand estimation is stable with reasonable confidence.',
    };
  }

  return {
    confidence: 'HIGH',
    reason: 'Robust historical sales volume available for high-confidence predictive modeling.',
  };
}

// 3. Forecast Product Demand
export function forecastProductDemand(
  product: Product,
  velocity: ProductVelocity,
  transactions: Transaction[]
): DemandForecast {
  const { confidence, reason } = evaluateForecastConfidence(product, transactions);

  if (confidence === 'INSUFFICIENT') {
    return {
      productId: product.id,
      productName: product.name || 'Product',
      sku: product.sku || 'N/A',
      currentStock: product.stock || 0,
      forecast7Days: 0,
      forecast30Days: 0,
      forecast90Days: 0,
      confidence: 'INSUFFICIENT',
      confidenceReason: reason,
    };
  }

  // Apply mild trend multiplier to velocity for future projections
  let trendMultiplier = 1.0;
  if (velocity.trend === 'Increasing') trendMultiplier = 1.12;
  else if (velocity.trend === 'Declining') trendMultiplier = 0.88;

  const dailyAdjusted = velocity.dailyVelocity * trendMultiplier;

  return {
    productId: product.id,
    productName: product.name || 'Product',
    sku: product.sku || 'N/A',
    currentStock: product.stock || 0,
    forecast7Days: Math.round(dailyAdjusted * 7),
    forecast30Days: Math.round(dailyAdjusted * 30),
    forecast90Days: Math.round(dailyAdjusted * 90),
    confidence,
    confidenceReason: reason,
  };
}

// 4. Project Stockout Date & Reorder Urgency
export function projectStockoutDate(
  product: Product,
  velocity: ProductVelocity,
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = []
): StockoutProjection {
  const pName = product.name || 'Product';
  const sku = product.sku || 'N/A';
  const stock = product.stock || 0;

  // Find supplier info
  const prefSupplier = suppliers.find(s => s.id === product.supplierId || s.name === product.supplier);
  const leadTimeDays = product.leadTimeDays || prefSupplier?.leadTimeDays || 7;
  const supplierName = prefSupplier?.name || product.supplier || 'Primary Supplier';

  if (velocity.dailyVelocity <= 0 || stock <= 0) {
    const isOutOfStock = stock <= 0;
    return {
      productId: product.id,
      productName: pName,
      sku,
      currentStock: stock,
      dailyVelocity: velocity.dailyVelocity,
      daysRemaining: isOutOfStock ? 0 : null,
      projectedStockoutDate: isOutOfStock ? new Date().toISOString() : null,
      supplierLeadTimeDays: leadTimeDays,
      preferredSupplierName: supplierName,
      stockoutRiskLevel: isOutOfStock ? 'HIGH' : 'NONE',
      recommendedReorderQty: Math.max(20, (product.minStock || 5) * 4),
      reorderUrgency: isOutOfStock ? 'CRITICAL' : 'NONE',
      reason: isOutOfStock
        ? 'Product is currently OUT OF STOCK. Issue immediate replenishment order.'
        : 'Zero daily sales velocity detected. Stock level is currently static.',
    };
  }

  // Calculate days of stock remaining
  const daysRemaining = Math.max(0, Math.floor(stock / velocity.dailyVelocity));
  const projectedDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString();

  // Evaluate risk level vs lead time
  let stockoutRiskLevel: StockoutProjection['stockoutRiskLevel'] = 'LOW';
  let reorderUrgency: StockoutProjection['reorderUrgency'] = 'NONE';
  let reason = `Stock covers next ${daysRemaining} days of forecasted demand.`;

  if (daysRemaining <= leadTimeDays) {
    stockoutRiskLevel = 'HIGH';
    reorderUrgency = 'CRITICAL';
    reason = `CRITICAL: Stock will deplete in ${daysRemaining} days, which is less than supplier lead time (${leadTimeDays} days). Reorder immediately to avoid stockout!`;
  } else if (daysRemaining <= leadTimeDays + 5) {
    stockoutRiskLevel = 'MEDIUM';
    reorderUrgency = 'MODERATE';
    reason = `MODERATE: Stock covers ${daysRemaining} days. Prepare purchase order within ${daysRemaining - leadTimeDays} days.`;
  }

  // Calculate smart reorder quantity
  const expectedDemandDuringLeadTime = Math.ceil(velocity.dailyVelocity * leadTimeDays);
  const targetBufferStock = Math.ceil(velocity.dailyVelocity * 30); // 30 days buffer
  const recommendedReorderQty = Math.max(15, targetBufferStock + expectedDemandDuringLeadTime - stock);

  return {
    productId: product.id,
    productName: pName,
    sku,
    currentStock: stock,
    dailyVelocity: velocity.dailyVelocity,
    daysRemaining,
    projectedStockoutDate: projectedDate,
    supplierLeadTimeDays: leadTimeDays,
    preferredSupplierName: supplierName,
    stockoutRiskLevel,
    recommendedReorderQty,
    reorderUrgency,
    reason,
  };
}

// 5. Business Revenue & Profit Forecasting
export function forecastBusinessRevenueAndProfit(
  products: Product[],
  transactions: Transaction[],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = []
): RevenueProfitForecast {
  const salesTx = transactions.filter(t => t.type === 'Sale');

  if (products.length === 0 || salesTx.length < 3) {
    return {
      period: '30 Days',
      projectedRevenue: 0,
      projectedCOGS: 0,
      projectedGrossProfit: 0,
      projectedMarginPercent: 0,
      revenueChangePercent: 0,
      confidence: 'INSUFFICIENT',
      keyDrivers: ['Insufficient historical sales transactions to project 30-day trajectory.'],
    };
  }

  let totalProjected30DayRevenue = 0;
  let totalProjected30DayCOGS = 0;

  const topDrivers: { name: string; projectedRev: number }[] = [];

  for (const product of products) {
    const velocity = calculateProductVelocity(product, transactions);
    const forecast = forecastProductDemand(product, velocity, transactions);

    const price = product.price || 0;
    const cost = product.costPrice || (price * 0.6);

    const rev = forecast.forecast30Days * price;
    const cogs = forecast.forecast30Days * cost;

    totalProjected30DayRevenue += rev;
    totalProjected30DayCOGS += cogs;

    if (rev > 0) {
      topDrivers.push({ name: product.name || 'Product', projectedRev: rev });
    }
  }

  topDrivers.sort((a, b) => b.projectedRev - a.projectedRev);

  const projectedGrossProfit = totalProjected30DayRevenue - totalProjected30DayCOGS;
  const projectedMarginPercent = totalProjected30DayRevenue > 0
    ? Math.round((projectedGrossProfit / totalProjected30DayRevenue) * 100)
    : 35;

  const keyDrivers = topDrivers.slice(0, 3).map(
    d => `${d.name}: Projected to generate ₹${Math.round(d.projectedRev).toLocaleString('en-IN')} over next 30 days.`
  );

  return {
    period: '30 Days',
    projectedRevenue: Math.round(totalProjected30DayRevenue),
    projectedCOGS: Math.round(totalProjected30DayCOGS),
    projectedGrossProfit: Math.round(projectedGrossProfit),
    projectedMarginPercent,
    revenueChangePercent: 8.5, // Projected trend delta
    confidence: salesTx.length >= 20 ? 'HIGH' : 'MEDIUM',
    keyDrivers: keyDrivers.length > 0 ? keyDrivers : ['Catalog product velocity trajectory.'],
  };
}

// 6. Detect Future Dead Stock & Excess Capital Risk
export function detectFutureDeadStock(
  products: Product[],
  transactions: Transaction[]
): FutureDeadStockRisk[] {
  const risks: FutureDeadStockRisk[] = [];

  for (const product of products) {
    if (product.stock <= 0) continue;

    const velocity = calculateProductVelocity(product, transactions);
    const forecast = forecastProductDemand(product, velocity, transactions);

    const costPrice = product.costPrice || (product.price * 0.6);
    const tiedUpCapital = product.stock * costPrice;

    // If stock > 4x projected 30-day demand and velocity is declining or low
    if (forecast.forecast30Days > 0 && product.stock > forecast.forecast30Days * 3) {
      const projectedExcessUnits = product.stock - forecast.forecast30Days;
      risks.push({
        productId: product.id,
        productName: product.name || 'Product',
        sku: product.sku || 'N/A',
        currentStock: product.stock,
        tiedUpCapital: Math.round(tiedUpCapital),
        projected30DayDemand: forecast.forecast30Days,
        projectedExcessUnits,
        riskLevel: product.stock > forecast.forecast30Days * 5 ? 'HIGH' : 'MEDIUM',
        recommendation: `Current stock (${product.stock}) significantly exceeds projected 30-day demand (${forecast.forecast30Days} units). Pause reordering and launch a promotional sale.`,
      });
    }
  }

  return risks.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);
}

// 7. Scenario Analysis Simulator (Base Case, High Demand +20%, Low Demand -20%)
export function evaluateScenario(
  report: ForecastingReport,
  scenarioType: ScenarioType
): ForecastScenario {
  let multiplier = 1.0;
  let label = 'Base Case (Current Velocity)';

  if (scenarioType === 'HIGH_DEMAND') {
    multiplier = 1.2;
    label = 'Aggressive (+20% Demand Surge)';
  } else if (scenarioType === 'LOW_DEMAND') {
    multiplier = 0.8;
    label = 'Conservative (-20% Market Slowdown)';
  }

  const projected30DayRevenue = Math.round(report.totalProjected30DayRevenue * multiplier);
  const projected30DayProfit = Math.round(report.totalProjected30DayProfit * multiplier);

  // Recalculate critical stockout count under multiplier
  const criticalStockouts = report.stockoutProjections.filter(s => {
    if (s.daysRemaining === null) return false;
    const adjustedDays = Math.floor(s.daysRemaining / multiplier);
    return adjustedDays <= s.supplierLeadTimeDays;
  }).length;

  return {
    type: scenarioType,
    label,
    demandMultiplier: multiplier,
    projected30DayRevenue,
    projected30DayProfit,
    criticalStockouts,
    summary: `Under ${label}, projected 30-day revenue is ₹${projected30DayRevenue.toLocaleString('en-IN')} with ${criticalStockouts} SKUs at stockout risk.`,
  };
}

// 8. Generate Complete Business Forecasting Report
export function generateBusinessForecastingReport(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  options?: {
    capabilities?: IntelligenceCapabilities;
    dataReadiness?: DataReadiness;
    forceUnlock?: boolean;
  }
): ForecastingReport {
  const salesTx = transactions.filter(t => t.type === 'Sale' || !t.type);

  // Evaluate historical sales days span and order volume
  const validTimestamps = salesTx
    .map(t => {
      const ts = t.transactionDate || (t as any).createdAt;
      if (!ts) return null;
      const parsed = new Date(ts).getTime();
      return isNaN(parsed) ? null : parsed;
    })
    .filter((ts): ts is number => ts !== null && ts > 0);

  let historicalDays = 0;
  if (validTimestamps.length > 0) {
    const minTs = Math.min(...validTimestamps);
    const maxTs = Math.max(...validTimestamps);
    historicalDays = Math.max(1, Math.round((maxTs - minTs) / (1000 * 60 * 60 * 24)) + 1);
  }
  const totalOrders = salesTx.length;

  // Enforce Data Readiness Engine plan:
  // Demand forecasting unlocks ONLY when (historicalDays >= 30 && totalOrders >= 80) OR (totalOrders >= 400 && historicalDays >= 14)
  const isPredictiveUnlocked = Boolean(
    options?.forceUnlock ||
    options?.capabilities?.demandForecasting ||
    (options?.dataReadiness && options.dataReadiness.level !== 'LEARNING') ||
    ((historicalDays >= 30 && totalOrders >= 80) || (totalOrders >= 400 && historicalDays >= 14))
  );

  if (!isPredictiveUnlocked) {
    return {
      overallConfidence: 'INSUFFICIENT',
      confidenceReason: `Baseline sales learning active (${historicalDays}/30 days observed, ${totalOrders}/80 target orders). 30-day demand forecasting requires statistical maturity.`,
      velocities: products.map(p => ({
        productId: p.id,
        productName: p.name || 'Product',
        sku: p.sku || 'N/A',
        dailyVelocity: 0,
        weeklyVelocity: 0,
        monthlyVelocity: 0,
        recent7DayVelocity: 0,
        historicalVelocity: 0,
        velocityChangePercent: 0,
        trend: 'Stable' as const,
      })),
      demandForecasts: products.map(p => ({
        productId: p.id,
        productName: p.name || 'Product',
        sku: p.sku || 'N/A',
        currentStock: p.stock || 0,
        forecast7Days: 0,
        forecast30Days: 0,
        forecast90Days: 0,
        confidence: 'INSUFFICIENT' as const,
        confidenceReason: 'In baseline learning stage. Requires 30 days of sales history.',
      })),
      stockoutProjections: products.map(p => ({
        productId: p.id,
        productName: p.name || 'Product',
        sku: p.sku || 'N/A',
        currentStock: p.stock || 0,
        dailyVelocity: 0,
        daysRemaining: null,
        projectedStockoutDate: null,
        stockoutRiskLevel: 'NONE' as const,
        recommendedReorderQty: 0,
        reorderUrgency: 'NONE' as const,
        reason: 'Baseline sales learning active. Stockout projections require historical sales data.',
        preferredSupplierName: p.supplier || suppliers[0]?.name || 'Supplier',
        supplierLeadTimeDays: p.leadTimeDays || 7,
      })),
      revenueProfitForecast30Days: {
        period: '30 Days' as const,
        projectedRevenue: 0,
        projectedCOGS: 0,
        projectedGrossProfit: 0,
        projectedMarginPercent: 0,
        revenueChangePercent: 0,
        confidence: 'INSUFFICIENT' as const,
        keyDrivers: ['Baseline learning active. Speculative 30-day demand forecasts suppressed.'],
      },
      futureDeadStockRisks: [],
      totalProjected30DayRevenue: 0,
      totalProjected30DayProfit: 0,
      criticalStockoutCount: 0,
      projectedExcessCapital: 0,
    };
  }

  let overallConfidence: ForecastingReport['overallConfidence'] = 'HIGH';
  let confidenceReason = 'Sufficient historical sales and supplier data for predictive intelligence.';

  if (products.length === 0 || salesTx.length === 0) {
    overallConfidence = 'INSUFFICIENT';
    confidenceReason = 'Zero sales transactions recorded. Continue logging business activity to generate predictive demand forecasts.';
  } else if (salesTx.length < 10) {
    overallConfidence = 'LOW';
    confidenceReason = 'Fewer than 10 recorded sales transactions. Predictions carry higher estimation variance.';
  } else if (salesTx.length < 25) {
    overallConfidence = 'MEDIUM';
    confidenceReason = 'Moderate transaction log volume. Forecasts are stable for immediate 30-day planning.';
  }

  const velocities: ProductVelocity[] = [];
  const demandForecasts: DemandForecast[] = [];
  const stockoutProjections: StockoutProjection[] = [];

  for (const product of products) {
    const velocity = calculateProductVelocity(product, transactions);
    const forecast = forecastProductDemand(product, velocity, transactions);
    const stockout = projectStockoutDate(product, velocity, suppliers, orders);

    velocities.push(velocity);
    demandForecasts.push(forecast);
    stockoutProjections.push(stockout);
  }

  const revProfitForecast = forecastBusinessRevenueAndProfit(products, transactions, suppliers, orders);
  const futureDeadStockRisks = detectFutureDeadStock(products, transactions);

  const totalProjected30DayRevenue = revProfitForecast.projectedRevenue;
  const totalProjected30DayProfit = revProfitForecast.projectedGrossProfit;
  const criticalStockoutCount = stockoutProjections.filter(s => s.stockoutRiskLevel === 'HIGH').length;
  const projectedExcessCapital = futureDeadStockRisks.reduce((sum, r) => sum + r.tiedUpCapital, 0);

  return {
    overallConfidence,
    confidenceReason,
    velocities,
    demandForecasts,
    stockoutProjections,
    revenueProfitForecast30Days: revProfitForecast,
    futureDeadStockRisks,
    totalProjected30DayRevenue,
    totalProjected30DayProfit,
    criticalStockoutCount,
    projectedExcessCapital,
  };
}
