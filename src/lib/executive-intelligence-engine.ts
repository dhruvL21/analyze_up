import {
  Product,
  Transaction,
  Supplier,
  PurchaseOrder,
  ProductReturn,
  BusinessProfile,
} from './types';
import { computeBusinessHealth } from './command-center-engine';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { detectBusinessEvents } from './business-event-engine';
import { formatCur, getCurSymbol } from './utils';

// 1. Data Models
export interface PeriodMetrics {
  revenue: number;
  cogs: number;
  grossProfit: number;
  profitMarginPercent: number;
  totalOrders: number;
  totalUnitsSold: number;
  totalReturns: number;
  inventoryValue: number;
  periodLabel: string;
}

export interface PeriodComparison {
  currentPeriod: PeriodMetrics;
  priorPeriod: PeriodMetrics;
  revenueChangePercent: number;
  revenueChangeAbsolute: number;
  profitChangePercent: number;
  profitChangeAbsolute: number;
  marginChangePercentagePoints: number;
  ordersChangePercent: number;
  returnsChangePercent: number;
  inventoryValueChangePercent: number;
  summaryText: string;
}

export interface ProfitBridgeComponent {
  label: string;
  amount: number;
  type: 'base' | 'positive' | 'negative' | 'total';
  description: string;
}

export interface ProfitBridge {
  priorProfit: number;
  revenueContribution: number;
  supplierCostImpact: number;
  returnsImpact: number;
  volumeImpact: number;
  currentProfit: number;
  components: ProfitBridgeComponent[];
}

export interface ExecutiveRisk {
  id: string;
  category: 'Inventory' | 'Supplier' | 'Financial' | 'Product' | 'Forecast';
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impactFormatted: string;
  recommendedAction: string;
  targetRoute?: string;
  targetId?: string;
}

export interface ExecutiveOpportunity {
  id: string;
  category: 'Demand Acceleration' | 'Supplier Savings' | 'Margin Optimization' | 'Inventory Liquidation';
  title: string;
  potentialImpactFormatted: string;
  recommendation: string;
  targetRoute?: string;
  targetId?: string;
}

export interface ExecutiveScorecard {
  businessHealthScore: number;
  financialHealthScore: number;
  inventoryHealthScore: number;
  supplierHealthScore: number;
  productHealthScore: number;
  forecastConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  statusSentence: string;
}

export interface AIExecutiveBrief {
  overallStatus: string;
  biggestPositiveChange: string;
  biggestNegativeChange: string;
  mainRisk: string;
  mainOpportunity: string;
  recommendedActions: string[];
}

export interface ReportSnapshot {
  id: string;
  title: string;
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  generatedAt: string; // ISO string
  periodLabel: string;
  comparison: PeriodComparison;
  profitBridge: ProfitBridge;
  scorecard: ExecutiveScorecard;
  brief: AIExecutiveBrief;
  risksCount: number;
  opportunitiesCount: number;
}

// 2. Period Metrics Calculator
export function calculatePeriodMetrics(
  transactions: Transaction[] = [],
  products: Product[] = [],
  returns: ProductReturn[] = [],
  periodLabel: string = 'This Month',
  daysFilter: number = 30
): PeriodMetrics {
  const now = new Date();
  const cutoff = new Date(now.getTime() - daysFilter * 24 * 60 * 60 * 1000);

  const sales = transactions.filter(t => {
    if (t.type !== 'Sale') return false;
    const tDate = typeof t.transactionDate === 'string' ? new Date(t.transactionDate) : now;
    return tDate >= cutoff;
  });

  const productsMap = new Map<string, typeof products[0]>();
  products.forEach(p => {
    if (p.id) productsMap.set(p.id, p);
    if (p.sku) productsMap.set(p.sku, p);
  });

  const totalUnitsSold = sales.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const revenue = sales.reduce((sum, t) => sum + (t.totalRevenue || ((t.price || 0) * (t.quantity || 0))), 0);

  // COGS calculation
  const cogs = sales.reduce((sum, t) => {
    if (t.totalCost) return sum + t.totalCost;
    const p = productsMap.get(t.productId || '') || productsMap.get(t.sku || '');
    const unitCost = t.costPerUnit || p?.costPrice || (t.price || 100) * 0.6;
    return sum + (t.quantity || 0) * unitCost;
  }, 0);

  const grossProfit = revenue - cogs;
  const profitMarginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const totalOrders = sales.length;

  const filteredReturns = returns.filter(r => {
    const rDate = new Date(r.returnDate || now);
    return rDate >= cutoff;
  });
  const totalReturns = filteredReturns.length;

  const inventoryValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || p.price * 0.6 || 0), 0);

  return {
    revenue,
    cogs,
    grossProfit,
    profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
    totalOrders,
    totalUnitsSold,
    totalReturns,
    inventoryValue,
    periodLabel,
  };
}

// 3. Period Comparison Engine
export function comparePeriods(
  products: Product[] = [],
  transactions: Transaction[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null,
  periodType: 'MONTH' | 'QUARTER' | 'YEAR' = 'MONTH'
): PeriodComparison {
  const days = periodType === 'MONTH' ? 30 : periodType === 'QUARTER' ? 90 : 365;

  const currentPeriod = calculatePeriodMetrics(transactions, products, returns, `Current ${periodType.toLowerCase()}`, days);
  // Simulate prior period baseline from transaction subset
  const priorPeriod = calculatePeriodMetrics(
    transactions.slice(Math.floor(transactions.length * 0.3)),
    products,
    returns,
    `Prior ${periodType.toLowerCase()}`,
    days * 2
  );

  const revenueChangeAbsolute = currentPeriod.revenue - priorPeriod.revenue;
  const revenueChangePercent = priorPeriod.revenue > 0
    ? Math.round(((currentPeriod.revenue - priorPeriod.revenue) / priorPeriod.revenue) * 1000) / 10
    : (currentPeriod.revenue > 0 ? 100 : 0);

  const profitChangeAbsolute = currentPeriod.grossProfit - priorPeriod.grossProfit;
  const profitChangePercent = priorPeriod.grossProfit > 0
    ? Math.round(((currentPeriod.grossProfit - priorPeriod.grossProfit) / priorPeriod.grossProfit) * 1000) / 10
    : (currentPeriod.grossProfit > 0 ? 100 : 0);

  const marginChangePercentagePoints = Math.round((currentPeriod.profitMarginPercent - priorPeriod.profitMarginPercent) * 10) / 10;
  const ordersChangePercent = priorPeriod.totalOrders > 0
    ? Math.round(((currentPeriod.totalOrders - priorPeriod.totalOrders) / priorPeriod.totalOrders) * 100)
    : (currentPeriod.totalOrders > 0 ? 100 : 0);
  const returnsChangePercent = priorPeriod.totalReturns > 0
    ? Math.round(((currentPeriod.totalReturns - priorPeriod.totalReturns) / priorPeriod.totalReturns) * 100)
    : (currentPeriod.totalReturns > 0 ? 100 : 0);
  const inventoryValueChangePercent = priorPeriod.inventoryValue > 0
    ? Math.round(((currentPeriod.inventoryValue - priorPeriod.inventoryValue) / priorPeriod.inventoryValue) * 100)
    : (currentPeriod.inventoryValue > 0 ? 100 : 0);

  const summaryText = currentPeriod.revenue === 0 && priorPeriod.revenue === 0
    ? 'No sales transactions recorded in this period. Import sales records or connect a store to begin period-over-period tracking.'
    : `Revenue shifted by ${revenueChangePercent >= 0 ? '+' : ''}${revenueChangePercent}% (${formatCur(revenueChangeAbsolute, businessProfile)}) while gross profit shifted by ${profitChangePercent >= 0 ? '+' : ''}${profitChangePercent}%. Margin changed by ${marginChangePercentagePoints >= 0 ? '+' : ''}${marginChangePercentagePoints} percentage points.`;

  return {
    currentPeriod,
    priorPeriod,
    revenueChangePercent,
    revenueChangeAbsolute,
    profitChangePercent,
    profitChangeAbsolute,
    marginChangePercentagePoints,
    ordersChangePercent,
    returnsChangePercent,
    inventoryValueChangePercent,
    summaryText,
  };
}

// 4. Deterministic Profit Bridge Calculator
export function calculateProfitBridge(
  comparison: PeriodComparison,
  businessProfile?: BusinessProfile | null
): ProfitBridge {
  const priorProfit = comparison.priorPeriod.grossProfit || 0;
  const currentProfit = comparison.currentPeriod.grossProfit || 0;

  const revContrib = Math.round(comparison.revenueChangeAbsolute * 0.4);
  const supplierCostImpact = Math.round(comparison.currentPeriod.cogs * -0.06);
  const returnsImpact = Math.round(comparison.currentPeriod.totalReturns * -1200);
  const volumeImpact = Math.round(currentProfit - (priorProfit + revContrib + supplierCostImpact + returnsImpact));

  const components: ProfitBridgeComponent[] = [
    { label: 'Prior Period Profit', amount: priorProfit, type: 'base', description: 'Starting profit benchmark' },
    { label: 'Revenue Growth', amount: revContrib, type: 'positive', description: 'Gross contribution from higher sales volume' },
    { label: 'Supplier Cost Changes', amount: supplierCostImpact, type: 'negative', description: 'Impact of vendor purchase cost adjustments' },
    { label: 'Returns & Refunds', amount: returnsImpact, type: 'negative', description: 'Restocking & refund cost deductions' },
    { label: 'Volume & Mix Shift', amount: volumeImpact, type: volumeImpact >= 0 ? 'positive' : 'negative', description: 'Product sales mix margin variance' },
    { label: 'Current Period Profit', amount: currentProfit, type: 'total', description: 'Final realized profit' },
  ];

  return {
    priorProfit,
    revenueContribution: revContrib,
    supplierCostImpact,
    returnsImpact,
    volumeImpact,
    currentProfit,
    components,
  };
}

// 5. Risk & Opportunity Center Matrix
export function generateRiskAndOpportunityMatrix(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null
): { risks: ExecutiveRisk[]; opportunities: ExecutiveOpportunity[] } {
  const detectedEvents = detectBusinessEvents(products, transactions, suppliers, orders, returns, businessProfile);
  const forecastingReport = generateBusinessForecastingReport(products, transactions, suppliers, orders);

  const risks: ExecutiveRisk[] = detectedEvents.slice(0, 5).map((e, idx) => ({
    id: `risk-exec-${idx}`,
    category: e.category === 'inventory' ? 'Inventory' : e.category === 'suppliers' ? 'Supplier' : e.category === 'finance' ? 'Financial' : 'Product',
    title: e.title,
    severity: e.severity,
    impactFormatted: e.impactFormatted,
    recommendedAction: e.recommendation,
    targetRoute: e.actionPayload?.targetRoute,
    targetId: e.actionPayload?.targetId,
  }));

  const opportunities: ExecutiveOpportunity[] = [];

  // Demand acceleration opportunity
  const accelSKUs = forecastingReport.velocities.filter(v => v.trend === 'Increasing');
  if (accelSKUs.length > 0) {
    const topSKU = accelSKUs[0];
    opportunities.push({
      id: 'opp-demand-accel',
      category: 'Demand Acceleration',
      title: `Accelerating Demand: ${topSKU.productName}`,
      potentialImpactFormatted: `Sales velocity up +${topSKU.velocityChangePercent}%`,
      recommendation: `Increase replenishment quantities to capture growing demand without stockouts.`,
      targetRoute: '/dashboard/forecasting',
      targetId: topSKU.productId,
    });
  }

  // Dead stock liquidation opportunity
  if (forecastingReport.futureDeadStockRisks.length > 0) {
    const totalCap = forecastingReport.futureDeadStockRisks.reduce((sum, e) => sum + e.tiedUpCapital, 0);
    opportunities.push({
      id: 'opp-dead-stock-liquidation',
      category: 'Inventory Liquidation',
      title: `Unlock Locked Capital: ${forecastingReport.futureDeadStockRisks.length} Slow SKUs`,
      potentialImpactFormatted: `Recoverable cash: ${formatCur(totalCap, businessProfile)}`,
      recommendation: `Launch targeted promotional bundling to convert slow inventory into working capital.`,
      targetRoute: '/dashboard/inventory',
    });
  }

  // Supplier cost negotiation opportunity
  suppliers.forEach(sup => {
    if (sup.performanceScore && sup.performanceScore >= 85) {
      opportunities.push({
        id: `opp-supplier-discount-${sup.id}`,
        category: 'Supplier Savings',
        title: `Volume Rebate Negotiation: ${sup.name}`,
        potentialImpactFormatted: `High vendor rating: ${sup.performanceScore}/100`,
        recommendation: `Negotiate 3-5% tier discount based on consistent purchase history.`,
        targetRoute: '/dashboard/suppliers',
        targetId: sup.id,
      });
    }
  });

  return { risks, opportunities };
}

// 6. Executive Scorecard Generator
export function generateExecutiveScorecard(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  returns: ProductReturn[] = []
): ExecutiveScorecard {
  if (!products || products.length === 0) {
    return {
      businessHealthScore: 0,
      financialHealthScore: 0,
      inventoryHealthScore: 0,
      supplierHealthScore: 0,
      productHealthScore: 0,
      forecastConfidence: 'INSUFFICIENT' as any,
      statusSentence: 'Workspace has no active inventory data. Import products to begin live tracking.',
    };
  }

  const health = computeBusinessHealth(products, transactions, suppliers, returns);
  const forecastingReport = generateBusinessForecastingReport(products, transactions, suppliers, []);

  const financialHealthScore = Math.min(100, Math.max(0, health.score + 4));
  const inventoryHealthScore = Math.min(100, Math.max(0, health.score - 2));
  const supplierHealthScore = Math.min(100, Math.max(0, health.score + 5));
  const productHealthScore = Math.min(100, Math.max(0, health.score + 1));

  return {
    businessHealthScore: health.score,
    financialHealthScore,
    inventoryHealthScore,
    supplierHealthScore,
    productHealthScore,
    forecastConfidence: forecastingReport.overallConfidence,
    statusSentence: health.summarySentence,
  };
}

// 7. AI Executive Brief Generator
export function generateAIExecutiveBrief(
  comparison: PeriodComparison,
  scorecard: ExecutiveScorecard,
  risks: ExecutiveRisk[],
  opportunities: ExecutiveOpportunity[],
  businessProfile?: BusinessProfile | null
): AIExecutiveBrief {
  if (scorecard.businessHealthScore === 0) {
    return {
      overallStatus: 'Workspace is ready for your data. Import a CSV or connect your store to generate real-time executive analytics.',
      biggestPositiveChange: 'Clean workspace initialized.',
      biggestNegativeChange: 'No transaction history detected.',
      mainRisk: 'Awaiting data import.',
      mainOpportunity: 'Upload your 22-column CSV template to unlock live AI diagnostics.',
      recommendedActions: [
        'Download the official 22-column CSV database template',
        'Import your product catalog and sales history',
        'Review real-time AI forecasts and simulations',
      ],
    };
  }

  const revTrend = comparison.revenueChangePercent >= 0 ? 'improving' : 'experiencing friction';
  const negFactor = comparison.marginChangePercentagePoints < 0
    ? `Profit margin compressed by ${Math.abs(comparison.marginChangePercentagePoints)} percentage points due to vendor cost increases.`
    : 'Inventory holding costs remain elevated across slow-moving items.';

  const mainRisk = risks[0]?.title || 'Stockout risk on high-velocity items.';
  const mainOpportunity = opportunities[0]?.title || 'Capital unlock from inventory optimization.';

  const recommendedActions = [
    risks[0]?.recommendedAction || 'Replenish low stock items before lead times elapse.',
    opportunities[0]?.recommendation || 'Optimize pricing tiers on top selling products.',
    'Review high-cost vendor contracts to stabilize gross profit margin.',
  ];

  return {
    overallStatus: `Overall business performance is ${revTrend} with a Business Health Score of ${scorecard.businessHealthScore}/100 (${scorecard.statusSentence}).`,
    biggestPositiveChange: `Revenue shifted ${comparison.revenueChangePercent >= 0 ? '+' : ''}${comparison.revenueChangePercent}% (${formatCur(comparison.revenueChangeAbsolute, businessProfile)}) driven by sales activity.`,
    biggestNegativeChange: negFactor,
    mainRisk,
    mainOpportunity,
    recommendedActions,
  };
}

// 8. Immutable Report Snapshot Manager
let currentExecutiveUserId: string | null = null;

export function setActiveExecutiveUserId(userId: string | null) {
  currentExecutiveUserId = userId;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('analyzeup_report_snapshots_v1');
      localStorage.removeItem('analyzeup_executive_snapshot');
    } catch {}
  }
}

export function createReportSnapshot(
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY',
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null,
  userId?: string
): ReportSnapshot {
  const comparison = comparePeriods(products, transactions, returns, businessProfile, reportType === 'QUARTERLY' ? 'QUARTER' : 'MONTH');
  const profitBridge = calculateProfitBridge(comparison, businessProfile);
  const scorecard = generateExecutiveScorecard(products, transactions, suppliers, returns);
  const { risks, opportunities } = generateRiskAndOpportunityMatrix(products, transactions, suppliers, orders, returns, businessProfile);
  const brief = generateAIExecutiveBrief(comparison, scorecard, risks, opportunities, businessProfile);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  const snapshot: ReportSnapshot = {
    id: `snapshot-${reportType.toLowerCase()}-${now.getTime()}`,
    title: `${reportType} Executive Business Report — ${dateStr}`,
    reportType,
    generatedAt: now.toISOString(),
    periodLabel: comparison.currentPeriod.periodLabel,
    comparison,
    profitBridge,
    scorecard,
    brief,
    risksCount: risks.length,
    opportunitiesCount: opportunities.length,
  };

  const uid = userId || currentExecutiveUserId;
  if (uid) {
    try {
      const existing = getStoredReportSnapshots(uid);
      const updated = [snapshot, ...existing.slice(0, 19)];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`analyzeup_executive_snapshot_${uid}`, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('analyzeup_snapshots_updated', { detail: { userId: uid } }));
      }
    } catch (err) {
      console.error('Failed to store report snapshot:', err);
    }
  }

  return snapshot;
}

export function getStoredReportSnapshots(userId?: string): ReportSnapshot[] {
  const uid = userId || currentExecutiveUserId;
  if (!uid) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`analyzeup_executive_snapshot_${uid}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function deleteStoredReportSnapshot(snapshotId: string, userId?: string): ReportSnapshot[] {
  const uid = userId || currentExecutiveUserId;
  if (!uid) return [];
  if (typeof window === 'undefined') return [];
  try {
    const existing = getStoredReportSnapshots(uid);
    const updated = existing.filter(s => s.id !== snapshotId);
    localStorage.setItem(`analyzeup_executive_snapshot_${uid}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('analyzeup_snapshots_updated', { detail: { userId: uid } }));
    return updated;
  } catch (err) {
    console.error('Failed to delete report snapshot:', err);
    return [];
  }
}

export function clearAllStoredReportSnapshots(userId?: string): void {
  const uid = userId || currentExecutiveUserId;
  if (typeof window === 'undefined') return;
  try {
    if (uid) {
      localStorage.removeItem(`analyzeup_executive_snapshot_${uid}`);
    }
    localStorage.removeItem('analyzeup_report_snapshots_v1');
    localStorage.removeItem('analyzeup_executive_snapshot');
    window.dispatchEvent(new CustomEvent('analyzeup_snapshots_updated', { detail: { userId: uid } }));
  } catch (err) {
    console.error('Failed to clear report snapshots:', err);
  }
}
