import { Product, Transaction, Supplier, PurchaseOrder, ProductReturn, BusinessProfile } from './types';
import { detectProcurementRisks, calculateProcurementSavings } from './supplier-intelligence-engine';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { predictOptimalClearanceDiscount } from './ml/clearance-pricing-model';
import { getBusinessBuddyCalibration } from './business-buddy-engine';
import { evaluateSalesHistory } from './sales-history-helper';
import { evaluateDataReadiness } from './data-readiness-engine';
import {
  toDomainProducts,
  toDomainTransactions,
  toDomainSuppliers,
  toDomainPurchaseOrders,
} from './domain-adapters';

export interface BusinessHealthSummary {
  score: number;
  category: 'Excellent' | 'Healthy' | 'Needs Attention' | 'Poor' | 'Critical';
  color: string;
  badgeClass: string;
  factors: {
    inventoryHealth: number;
    profitability: number;
    marginHealth: number;
    salesRevenueHealth: number;
    capitalEfficiency: number;
    supplierPerformance: number;
    orderFulfillmentHealth: number;
    deadStockRatio: number;
  };
  summarySentence: string;
}

export interface ActionTask {
  id: string;
  title: string;
  problem: string;
  reason: string;
  impact: string;
  recommendation: string;
  priority: 'High' | 'Medium' | 'Low';
  estimatedBenefit: string;
  actionType: 'reorder' | 'discount' | 'price_up' | 'supplier' | 'audit' | 'review_returns' | 'promote';
  targetId?: string;
  targetName?: string;
}

export interface KPICardItem {
  key: string;
  title: string;
  value: string;
  rawValue: number;
  change: string; // e.g. "+12%" or "-8%"
  isPositiveChange: boolean;
  interpretation: string;
  count?: number;
  countLabel?: string;
}

export interface InventoryQualityMetrics {
  healthyCount: number;
  lowStockCount: number;
  criticalStockCount: number;
  deadStockCount: number;
  fastMovingCount: number;
  slowMovingCount: number;
  recentlyAddedCount: number;
  topValuableProducts: { name: string; sku: string; value: number; stock: number }[];
}

export interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'sale' | 'import' | 'alert' | 'supplier' | 'order' | 'ai';
  iconName: string;
}

export interface TodayPriorityItem {
  id: string;
  title: string;
  category: string;
  actionLabel: string;
  route: string;
}

// 1. Calculate Dynamic Business Health Score (0-100) with 6 core health metrics
export function computeBusinessHealth(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  rawSuppliers: Supplier[] = [],
  rawReturns: ProductReturn[] = [],
  rawOrders: PurchaseOrder[] = []
): BusinessHealthSummary {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const suppliers = toDomainSuppliers(rawSuppliers);
  const returns = rawReturns || [];
  const orders = toDomainPurchaseOrders(rawOrders || []);

  if (!products || products.length === 0) {
    return {
      score: 0,
      category: 'Needs Attention',
      color: '#6b7280',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      factors: {
        inventoryHealth: 0,
        profitability: 0,
        marginHealth: 0,
        salesRevenueHealth: 0,
        capitalEfficiency: 0,
        supplierPerformance: 0,
        orderFulfillmentHealth: 0,
        deadStockRatio: 0,
      },
      summarySentence: 'Workspace has no active inventory data. Import products to begin live tracking.',
    };
  }

  // 1. Inventory Health: In-stock vs low-stock buffer & stockout rates
  const inStockProducts = products.filter(p => p.stock >= (p.minStock || 5));
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < (p.minStock || 5));
  let inventoryHealth = Math.round(
    ((inStockProducts.length * 100) + (lowStockProducts.length * 60)) / products.length
  );
  inventoryHealth = Math.min(100, Math.max(0, inventoryHealth));

  // 2. Profitability: Gross margin across transactions vs COGS and catalog markups, adjusted for return losses
  const productsMap = new Map<string, typeof products[0]>();
  products.forEach(p => {
    if (p.id) productsMap.set(p.id, p);
    if (p.sku) productsMap.set(p.sku, p);
  });

  const saleTransactions = transactions.filter(t => t.type === 'Sale');
  const totalSales = saleTransactions.reduce(
    (acc, t) => acc + (t.totalRevenue || ((t.quantity || 1) * (t.price || 0))),
    0
  );
  const totalCOGS = saleTransactions.reduce((acc, t) => {
    if (t.totalCost !== undefined) return acc + t.totalCost;
    const p = productsMap.get(t.productId || '') || productsMap.get(t.sku || '');
    return acc + ((t.quantity || 1) * (p?.costPrice || (p?.price ? p.price * 0.6 : 0)));
  }, 0);

  let rawProfitMarginPercent = 35;
  if (totalSales > 0) {
    rawProfitMarginPercent = ((totalSales - totalCOGS) / totalSales) * 100;
  } else {
    const catalogMargins = products.map(p => {
      const price = p.price || 0;
      const cost = p.costPrice !== undefined ? p.costPrice : price * 0.6;
      return price > 0 ? ((price - cost) / price) * 100 : 35;
    });
    rawProfitMarginPercent = catalogMargins.length > 0
      ? catalogMargins.reduce((a, b) => a + b, 0) / catalogMargins.length
      : 35;
  }

  // Adjust for return refund impact
  const totalRefunds = returns
    .filter(r => r.refundStatus === 'Refunded' || r.refundStatus === 'Store Credit')
    .reduce((acc, r) => acc + (r.refundAmount || 0), 0);
  const refundMarginDrag = totalSales > 0 ? Math.min(25, (totalRefunds / totalSales) * 100) : 0;
  const netMarginPercent = Math.max(0, rawProfitMarginPercent - refundMarginDrag);

  // Benchmark: 45% margin = 100 score
  let profitability = Math.min(100, Math.max(10, Math.round((netMarginPercent / 45) * 100)));
  const marginHealth = profitability; // Alias for backward compatibility

  // 3. Sales & Revenue Health: Velocity, active catalog sell-through, and return drag
  const salesHistory = evaluateSalesHistory(rawProducts, rawTransactions);
  const isDeadStockActive = salesHistory.hasMinimumHistory;

  let salesRevenueHealth = 85; // Baseline healthy score for learning/nascent stores
  if (isDeadStockActive) {
    const soldProductIds = new Set(
      saleTransactions.map(t => t.productId || t.sku).filter(Boolean)
    );
    const activeSellThroughRatio = products.length > 0
      ? Math.round((soldProductIds.size / products.length) * 100)
      : 50;

    const returnRatePct = saleTransactions.length > 0
      ? (returns.length / saleTransactions.length) * 100
      : 0;
    const returnPenalty = Math.min(25, Math.round(returnRatePct * 1.2));
    const velocityScore = Math.min(100, Math.round(saleTransactions.length * 2.5));

    salesRevenueHealth = Math.min(
      100,
      Math.max(20, Math.round(activeSellThroughRatio * 0.5 + velocityScore * 0.5 - returnPenalty))
    );
  } else {
    const earlyTraction = saleTransactions.length > 0 ? Math.min(15, saleTransactions.length * 2) : 0;
    const returnRatePct = saleTransactions.length > 0 ? (returns.length / saleTransactions.length) * 100 : 0;
    const returnPenalty = Math.min(20, Math.round(returnRatePct * 1.5));
    salesRevenueHealth = Math.min(100, Math.max(50, 80 + earlyTraction - returnPenalty));
  }

  // 4. Capital Efficiency: Circulating working capital vs dead / idle inventory
  const saleProductIds = new Set(saleTransactions.map(t => t.productId));
  const deadStockProducts = isDeadStockActive
    ? products.filter(p => p.stock > 0 && !saleProductIds.has(p.id) && salesHistory.isProductEligibleForDeadStock(p))
    : [];
  const deadStockRatio = isDeadStockActive
    ? Math.round(Math.max(0, 100 - (deadStockProducts.length / products.length) * 100))
    : 100;

  const totalValuation = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
  const deadStockValuation = deadStockProducts.reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.6)), 0);
  let capitalEfficiency = totalValuation > 0
    ? (isDeadStockActive ? Math.round(Math.max(10, 100 - (deadStockValuation / totalValuation) * 100)) : 100)
    : 100;

  // 5. Supplier Performance: Supplier lead times and PO turnaround / fulfillment rate
  const avgSupplierLead = products.length > 0
    ? products.reduce((acc, p) => acc + (p.leadTimeDays || 7), 0) / products.length
    : 7;
  const leadTimeScore = Math.min(100, Math.max(30, Math.round(100 - (avgSupplierLead - 3) * 5)));

  let supplierPerformance = leadTimeScore;
  if (orders && orders.length > 0) {
    const fulfilledPOs = orders.filter(o => o.status === 'Delivered' || o.status === 'Fulfilled').length;
    const nonCancelledPOs = orders.filter(o => o.status !== 'Cancelled').length;
    const poFulfillmentRate = nonCancelledPOs > 0 ? Math.round((fulfilledPOs / nonCancelledPOs) * 100) : 85;
    supplierPerformance = Math.min(100, Math.max(25, Math.round(leadTimeScore * 0.5 + poFulfillmentRate * 0.5)));
  }

  // 6. Order/Fulfillment Health: Customer order completion, payment receipt, and return avoidance
  let orderFulfillmentHealth = 90;
  if (saleTransactions.length > 0) {
    const paidCount = saleTransactions.filter(
      t => t.financialStatus === 'PAID' || t.paymentReceived === true || t.isRevenueRecognized === true || !t.financialStatus
    ).length;
    const paymentRate = (paidCount / saleTransactions.length) * 100;

    const fulfilledCount = saleTransactions.filter(
      t => t.fulfillmentStatus === 'FULFILLED' || t.fulfillmentStatus === 'DELIVERED' || !t.fulfillmentStatus
    ).length;
    const fulfillmentRate = (fulfilledCount / saleTransactions.length) * 100;

    const returnRatio = returns.length / saleTransactions.length;
    const returnPenalty = Math.min(30, Math.round(returnRatio * 100 * 1.5));

    orderFulfillmentHealth = Math.min(
      100,
      Math.max(20, Math.round((paymentRate * 0.5 + fulfillmentRate * 0.5) - returnPenalty))
    );
  }

  // Dynamic Founder Execution Bonus (reads from audit logs and performed tasks)
  let executedActionCount = 0;
  if (typeof window !== 'undefined') {
    try {
      const logsStr = localStorage.getItem('analyzeup_business_audit_logs');
      if (logsStr) {
        const logs = JSON.parse(logsStr);
        executedActionCount = Array.isArray(logs) ? logs.length : 0;
      }
      const completedTasksStr = localStorage.getItem('analyzeup_completed_tasks');
      if (completedTasksStr) {
        const completedTasks = JSON.parse(completedTasksStr);
        executedActionCount += Array.isArray(completedTasks) ? completedTasks.length : 0;
      }
    } catch {
      executedActionCount = 0;
    }
  }

  // Boost metrics based on executed tasks
  const executionBonus = Math.min(20, executedActionCount * 3);
  inventoryHealth = Math.min(100, inventoryHealth + Math.round(executionBonus * 0.3));
  profitability = Math.min(100, profitability + Math.round(executionBonus * 0.3));
  salesRevenueHealth = Math.min(100, salesRevenueHealth + Math.round(executionBonus * 0.3));
  capitalEfficiency = Math.min(100, capitalEfficiency + Math.round(executionBonus * 0.4));
  supplierPerformance = Math.min(100, supplierPerformance + Math.round(executionBonus * 0.3));
  orderFulfillmentHealth = Math.min(100, orderFulfillmentHealth + Math.round(executionBonus * 0.2));

  // Overall Weighted Score (Weights sum to 100%):
  // Inventory Health: 20%
  // Profitability: 20%
  // Sales & Revenue Health: 20%
  // Capital Efficiency: 15%
  // Supplier Performance: 15%
  // Order/Fulfillment Health: 10%
  let score = Math.round(
    inventoryHealth * 0.20 +
    profitability * 0.20 +
    salesRevenueHealth * 0.20 +
    capitalEfficiency * 0.15 +
    supplierPerformance * 0.15 +
    orderFulfillmentHealth * 0.10 +
    executionBonus * 0.15
  );

  score = Math.min(100, Math.max(0, score));

  let category: BusinessHealthSummary['category'] = 'Healthy';
  let color = '#10b981';
  let badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  if (score >= 90) {
    category = 'Excellent';
    color = '#10b981';
    badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (score >= 75) {
    category = 'Healthy';
    color = '#10b981';
    badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (score >= 55) {
    category = 'Needs Attention';
    color = '#f59e0b';
    badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  } else if (score >= 35) {
    category = 'Poor';
    color = '#f97316';
    badgeClass = 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  } else {
    category = 'Critical';
    color = '#ef4444';
    badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  }

  let summarySentence = 'Operations are stable with balanced inventory velocity and healthy order fulfillment.';
  if (!isDeadStockActive) {
    summarySentence = 'Baseline learning active: observing catalog sales rhythm.';
  } else if (deadStockProducts.length > 5) {
    summarySentence = `Capital lockup detected: ${deadStockProducts.length} dead stock items require clearance.`;
  } else if (inventoryHealth < 70) {
    summarySentence = `Stockout vulnerability: ${products.length - inStockProducts.length} items running low or out of stock.`;
  } else if (orderFulfillmentHealth < 70) {
    summarySentence = 'Fulfillment risk detected: monitor unfulfilled orders and return rates.';
  } else if (score >= 90) {
    summarySentence = 'Excellent operational health and strong profit margins across SKUs.';
  }

  return {
    score,
    category,
    color,
    badgeClass,
    factors: {
      inventoryHealth,
      profitability,
      marginHealth: profitability,
      salesRevenueHealth,
      capitalEfficiency,
      supplierPerformance,
      orderFulfillmentHealth,
      deadStockRatio,
    },
    summarySentence,
  };
}

// Helper slug generator for 100% unique IDs
const getSlug = (str: string) => (str || 'item').toLowerCase().replace(/[^a-z0-9]/g, '-');

// 2. Generate Action Center Tasks
export function generateActionTasks(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  rawSuppliers: Supplier[] = [],
  rawOrders: PurchaseOrder[] = [],
  businessProfile?: BusinessProfile | null,
  rawReturns: ProductReturn[] = []
): ActionTask[] {
  // Respect Data Readiness and Business Buddy learning phase (unless explicitly overridden by founder)
  const readiness = evaluateDataReadiness(rawProducts, rawTransactions);
  const calibration = getBusinessBuddyCalibration(businessProfile, rawProducts, rawTransactions, rawReturns);
  if (!calibration.isOverridden && (readiness.level === 'LEARNING' || !readiness.capabilities.reorderRecommendations || calibration.status === 'LEARNING')) {
    return [];
  }

  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const suppliers = toDomainSuppliers(rawSuppliers);
  const orders = toDomainPurchaseOrders(rawOrders);

  const tasks: ActionTask[] = [];
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
  const formatCurrency = (val: number) => {
    const isNegative = val < 0;
    const num = Math.abs(val);
    const sign = isNegative ? '-' : '';
    if (num >= 10000000) {
      return `${sign}${currencySymbol}${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `${sign}${currencySymbol}${(num / 100000).toFixed(2)} Lakh`;
    }
    return `${sign}${currencySymbol}${Math.round(num).toLocaleString('en-IN')}`;
  };

  // Task Group 1: Low / Critical Stock Items (Calibrated by Lead Time Runway)
  const lowStock = [...products]
    .filter(p => {
      if (!p || !p.name) return false;
      const leadTime = p.leadTimeDays || 7;
      const velocity = p.averageDailySales || (p.stock === 0 ? 0.5 : 0);
      const daysOfStock = velocity > 0 ? p.stock / velocity : (p.stock === 0 ? 0 : 999);
      return p.stock === 0 || p.stock <= (p.minStock || 5) || daysOfStock <= leadTime + 3;
    })
    .sort((a, b) => (a.stock / (a.minStock || 5)) - (b.stock / (b.minStock || 5)) || (a.name || '').localeCompare(b.name || ''));

  lowStock.slice(0, 5).forEach((topLow) => {
    const pName = topLow.name || topLow.productName || 'Product';
    const targetSlug = topLow.id || topLow.sku || getSlug(pName);
    const rawPrice = topLow.price && topLow.price > 0 ? topLow.price : (topLow.costPrice ? topLow.costPrice * 1.5 : 499);
    const pPrice = Math.min(25000, Math.max(50, rawPrice));
    const leadTime = topLow.leadTimeDays || 7;
    const velocity = topLow.averageDailySales || 1.2;
    const targetOptimalStock = Math.ceil(velocity * (leadTime + 21)); // 28-day optimal buffer
    const currentStock = topLow.stock || 0;
    const reorderQty = Math.max(15, targetOptimalStock > currentStock ? targetOptimalStock - currentStock : Math.ceil(velocity * 21));
    const estimatedLoss = Math.round(pPrice * reorderQty);

    tasks.push({
      id: `task-reorder-${targetSlug}`,
      title: `Restock Required: ${pName}`,
      problem: `Current quantity is ${topLow.stock} ${topLow.unit || 'units'} (runway is below supplier lead time window of ${leadTime} days).`,
      reason: `Consumer demand velocity (${velocity}/day) will deplete stock before the next supplier delivery cycle.`,
      impact: `Estimated revenue loss of ${formatCurrency(estimatedLoss)} if inventory empties before restock.`,
      recommendation: `Place a purchase order for ${reorderQty} ${topLow.unit || 'units'} with ${topLow.supplier || 'supplier'} to re-establish a healthy 4-week buffer.`,
      priority: topLow.stock === 0 ? 'High' : 'High',
      estimatedBenefit: `Protect ${formatCurrency(estimatedLoss)} revenue runway`,
      actionType: 'reorder',
      targetId: targetSlug,
      targetName: pName,
    });
  });

  // Task Group 2: Dead Stock Liquidation (Individual predictive clearance discounts)
  // Dynamic Rule: Requires at least 30 days of sales history (or founder override)
  const salesHistory = evaluateSalesHistory(rawProducts, rawTransactions);
  const deadStock = (salesHistory.hasMinimumHistory || calibration.isOverridden)
    ? [...products]
        .filter(p => p && p.name && p.stock > 0 && (calibration.isOverridden ? !transactions.some(t => t.productId === p.id) : salesHistory.isProductEligibleForDeadStock(p)) && p.liquidationStatus !== 'Liquidated' && !(p.compareAtPrice && p.compareAtPrice > p.price))
        .sort((a, b) => (b.stock * (b.costPrice || b.price * 0.6)) - (a.stock * (a.costPrice || a.price * 0.6)) || (a.name || '').localeCompare(b.name || ''))
    : [];

  const deadStockIds = new Set(deadStock.map(p => p.id));

  deadStock.slice(0, 5).forEach((topDead) => {
    const pName = topDead.name || topDead.productName || 'Product';
    const targetSlug = topDead.id || topDead.sku || getSlug(pName);
    const pred = predictOptimalClearanceDiscount(topDead);
    const tiedCapital = (topDead.stock || 1) * pred.costPrice;

    tasks.push({
      id: `task-discount-${targetSlug}`,
      title: `Liquidate Dead Stock: ${pName}`,
      problem: `${topDead.stock} ${topDead.unit || 'units'} sitting unsold with zero customer transactions (${pred.grossMarginBefore}% margin headroom).`,
      reason: `Overstocking or seasonal shift resulted in dormant capital lockup.`,
      impact: `${formatCurrency(Math.round(tiedCapital))} working capital frozen in dormant inventory.`,
      recommendation: `Launch a ${pred.discountPercent}% clearance promo (Price: ${formatCurrency(pred.newPrice)}) to unfreeze capital.`,
      priority: 'High',
      estimatedBenefit: `Unlock ${formatCurrency(pred.estimatedCashUnlocked)} cash flow`,
      actionType: 'discount',
      targetId: targetSlug,
      targetName: pName,
    });
  });

  // Task Group 3: Pricing Optimization (High Demand & High Margin Expansion)
  // Exclude products that are dead stock
  const highDemandProducts = (salesHistory.hasMinimumHistory || calibration.isOverridden)
    ? [...products]
        .filter(p => p && p.name && !deadStockIds.has(p.id) && (p.averageDailySales || 0) >= 0.5 && (p.price || 0) > 0)
        .sort((a, b) => (b.averageDailySales || 0) - (a.averageDailySales || 0) || (a.name || '').localeCompare(b.name || ''))
    : [];

  highDemandProducts.slice(0, 4).forEach((topDemand) => {
    const pName = topDemand.name || topDemand.productName || 'Product';
    const targetSlug = topDemand.id || topDemand.sku || getSlug(pName);
    const pPrice = Math.min(50000, Math.max(50, topDemand.price || 500));
    const costPrice = topDemand.costPrice || pPrice * 0.6;
    const margin = Math.round(((pPrice - costPrice) / pPrice) * 100);
    
    // Suggest 8% to 12% price hike for high velocity items
    const hikePercent = margin < 25 ? 12 : 8;
    const newPrice = Math.round(pPrice * (1 + hikePercent / 100));
    const addedProfit = Math.round((newPrice - pPrice) * (topDemand.stock || 20));

    tasks.push({
      id: `task-price-${targetSlug}`,
      title: `Margin Optimization (+${hikePercent}%): ${pName}`,
      problem: `High consumer demand (${topDemand.averageDailySales || 1.2} units/day) with margin (${margin}%) below benchmark.`,
      reason: `Current selling price is under-indexed against market willingness-to-pay.`,
      impact: `Unclaimed margin expansion potential on recurring customer transactions.`,
      recommendation: `Adjust selling price from ${formatCurrency(pPrice)} to ${formatCurrency(newPrice)} (+${hikePercent}% margin boost).`,
      priority: 'Medium',
      estimatedBenefit: `+${formatCurrency(addedProfit)} net profit expansion`,
      actionType: 'price_up',
      targetId: targetSlug,
      targetName: pName,
    });
  });

  // Task Group 4: Cross-Sell Bundles & AOV Growth
  const topSellers = [...products]
    .filter(p => (p.averageDailySales || 0) >= 0.8 && p.stock > 10)
    .slice(0, 2);

  topSellers.forEach(item => {
    const pName = item.name || 'Best Seller';
    const targetSlug = item.id || getSlug(pName);
    const estLift = Math.round((item.price || 1200) * 0.25 * 10);
    tasks.push({
      id: `task-bundle-${targetSlug}`,
      title: `Bundle Growth Opportunity: ${pName}`,
      problem: `Single-item checkouts for ${pName} cap average order value at ${formatCurrency(item.price || 1200)}.`,
      reason: `Customers buying ${pName} frequently search for complementary accessories.`,
      impact: `Missed +20% Average Order Value (AOV) expansion on high-intent buyer traffic.`,
      recommendation: `Launch a 10% combo bundle pairing ${pName} with high-margin catalog accessories.`,
      priority: 'Medium',
      estimatedBenefit: `+${formatCurrency(estLift)} AOV revenue lift`,
      actionType: 'discount',
      targetId: targetSlug,
      targetName: pName,
    });
  });

  // Task Group 5: Supplier Procurement Intelligence & Risk Actions
  const procurementRisks = detectProcurementRisks(products, suppliers, orders || [], transactions);
  procurementRisks.slice(0, 3).forEach((risk) => {
    const targetSlug = getSlug(risk.supplierName);
    tasks.push({
      id: `task-supplier-${risk.id}`,
      title: `${risk.type === 'cost_increase' ? 'Supplier Cost Increase' : (risk.type === 'single_supplier_dependency' ? 'Single-Supplier Risk' : 'Delivery Delay Risk')}: ${risk.supplierName}`,
      problem: risk.problem,
      reason: risk.reason,
      impact: risk.impact,
      recommendation: risk.recommendation,
      priority: risk.riskLevel === 'HIGH' ? 'High' : 'Medium',
      estimatedBenefit: risk.riskLevel === 'HIGH' ? 'Protect margins & stockout risk' : 'Optimize procurement performance',
      actionType: 'supplier',
      targetId: targetSlug,
      targetName: risk.supplierName,
    });
  });

  // Task Group 6: Procurement Cost Savings Opportunity
  const savingsResult = calculateProcurementSavings(products, suppliers, orders || [], transactions);
  if (savingsResult.savingsList.length > 0) {
    const topSave = savingsResult.savingsList[0];
    tasks.push({
      id: `task-saving-${getSlug(topSave.productId)}`,
      title: `Potential Procurement Saving: ${formatCurrency(topSave.potentialGrossSaving)}`,
      problem: `Paying ₹${topSave.currentCost} to ${topSave.currentSupplierName} for ${topSave.productName}.`,
      reason: `Alternative vendor (${topSave.alternativeSupplierName}) supplies comparable items at ₹${topSave.alternativeCost} (₹${topSave.unitSaving} cheaper/unit).`,
      impact: `Potential annual savings of ${formatCurrency(topSave.potentialGrossSaving)}.`,
      recommendation: topSave.recommendation,
      priority: 'Medium',
      estimatedBenefit: `Unlock ${formatCurrency(topSave.potentialGrossSaving)} gross savings`,
      actionType: 'supplier',
      targetId: getSlug(topSave.currentSupplierName),
      targetName: topSave.currentSupplierName,
    });
  }

  // Task Group 7: Predictive Stockout & Velocity Warnings
  const forecastingReport = generateBusinessForecastingReport(products, transactions, suppliers, orders);
  forecastingReport.stockoutProjections
    .filter(s => s.stockoutRiskLevel === 'HIGH')
    .slice(0, 2)
    .forEach(stockout => {
      tasks.push({
        id: `task-forecast-stockout-${getSlug(stockout.productId)}`,
        title: `Predictive Restock Alert: ${stockout.productName}`,
        problem: `Stockout projected in ${stockout.daysRemaining} days (before ${stockout.supplierLeadTimeDays}-day lead time).`,
        reason: stockout.reason,
        impact: `Risk of unfulfilled orders and revenue loss for ${stockout.productName}.`,
        recommendation: `Issue purchase order for ${stockout.recommendedReorderQty} units with ${stockout.preferredSupplierName} immediately.`,
        priority: 'High',
        estimatedBenefit: 'Prevent operational stockout & protect sales trajectory',
        actionType: 'reorder',
        targetId: stockout.productId,
        targetName: stockout.productName,
      });
    });

  // Fallback default tasks if catalog is fresh
  if (tasks.length === 0) {
    tasks.push({
      id: 'task-audit-1',
      title: 'Complete Weekly Inventory Audit',
      problem: 'Routine physical count verification required.',
      reason: 'Periodic audits maintain 99%+ stock accuracy.',
      impact: 'Prevents phantom inventory and discrepancy errors.',
      recommendation: 'Verify physical stock counts for top 10 valuable SKUs.',
      priority: 'Low',
      estimatedBenefit: 'Ensure 100% data integrity',
      actionType: 'audit',
    });
  }

  return tasks;
}

// 3. Generate Today Priorities
export function generateTodayPriorities(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  rawSuppliers: Supplier[] = []
): TodayPriorityItem[] {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const suppliers = toDomainSuppliers(rawSuppliers);

  const priorities: TodayPriorityItem[] = [];

  const lowStock = products.filter(p => p.stock <= (p.minStock || 5));
  if (lowStock.length > 0) {
    priorities.push({
      id: 'prio-low-stock',
      title: `Reorder ${lowStock.length} Low-Stock Products (${lowStock[0]?.name || 'Items'})`,
      category: 'Inventory Risk',
      actionLabel: 'Restock Now',
      route: '/dashboard/inventory?q=low stock',
    });
  }

  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStock = products.filter(p => p.stock > 0 && !saleProductIds.has(p.id));
  if (deadStock.length > 0) {
    priorities.push({
      id: 'prio-dead-stock',
      title: `Clear ${deadStock.length} Stagnant Dead Stock SKUs`,
      category: 'Capital Lockup',
      actionLabel: 'Launch Promo',
      route: '/dashboard/inventory?q=dead stock',
    });
  }

  priorities.push({
    id: 'prio-analytics',
    title: 'Review Weekly Margin Performance & Best Sellers',
    category: 'Revenue Growth',
    actionLabel: 'View Analytics',
    route: '/dashboard/insights',
  });

  if (suppliers && suppliers.length > 0) {
    priorities.push({
      id: 'prio-suppliers',
      title: `Optimize Vendor Lead Times (${suppliers.length} Active Suppliers)`,
      category: 'Supply Chain',
      actionLabel: 'View Vendors',
      route: '/dashboard/suppliers',
    });
  }

  return priorities.slice(0, 5);
}

// Helper to extract timestamp from transaction in ms
function getTxTimestamp(t: Transaction): number {
  const d: any = t.transactionDate || t.createdAt;
  if (!d) return 0;
  if (typeof d === 'number') return d;
  if (d._seconds) return d._seconds * 1000;
  const parsed = Date.parse(d);
  return isNaN(parsed) ? 0 : parsed;
}

// 4. Compute Executive KPI Card Interpretations
export function computeExecutiveKPIs(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  businessProfile?: BusinessProfile | null
): KPICardItem[] {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Build high-performance product lookup map for accurate COGS
  const productMap = new Map<string, Product>();
  products.forEach(p => {
    if (p.id) productMap.set(String(p.id).toLowerCase(), p);
    if (p.sku) productMap.set(String(p.sku).toLowerCase(), p);
    if (p.name) productMap.set(String(p.name).toLowerCase(), p);
  });

  const salesTx = transactions.filter(t => (t.type || '').toLowerCase() === 'sale');

  // 1. Fulfilled / Delivered sales -> Recognized Revenue & COGS
  const fulfilledSalesTx = salesTx.filter(t => {
    const rawFulfillment = String(t.fulfillmentStatus || t.status || '').toUpperCase();
    return (
      t.isRevenueRecognized === true ||
      rawFulfillment === 'FULFILLED' ||
      rawFulfillment === 'DELIVERED' ||
      rawFulfillment === 'SHIPPED' ||
      rawFulfillment === 'COMPLETED'
    );
  });

  // 2. Placed / Unfulfilled sales -> Pending Order Pipeline (positive sales awaiting fulfillment)
  const pendingSalesTx = salesTx.filter(t => {
    const isFulf = fulfilledSalesTx.includes(t);
    const qty = Number(t.quantity ?? 1);
    const rev = Number(t.totalRevenue ?? ((t.price || 0) * qty));
    return !isFulf && qty > 0 && rev > 0;
  });

  // Unique pending order count deduplicated by order number/id
  const pendingOrderIds = new Set<string>();
  pendingSalesTx.forEach(t => {
    const id = t.orderNumber || t.orderId || t.id;
    if (id) pendingOrderIds.add(String(id));
  });
  const pendingOrderCount = pendingOrderIds.size || pendingSalesTx.length;
  const pendingOrderVal = pendingSalesTx.reduce((sum, t) => sum + Number(t.totalRevenue ?? ((t.price || 0) * (t.quantity || 1))), 0);

  // 3. Total Sales Orders (deduplicated by orderNumber or id)
  const totalOrderIds = new Set<string>();
  salesTx.forEach(t => {
    const id = t.orderNumber || t.orderId || t.id;
    if (id) totalOrderIds.add(String(id));
  });
  const totalOrdersCount = totalOrderIds.size || salesTx.length;

  const recognizedRev = fulfilledSalesTx.reduce((sum, t) => sum + Number(t.totalRevenue ?? ((t.price || 0) * (t.quantity || 1))), 0);

  // Accurate COGS calculation looking up products from catalog
  const recognizedCOGS = fulfilledSalesTx.reduce((sum, t) => {
    if (t.totalCost !== undefined && t.totalCost > 0) return sum + t.totalCost;
    
    const p = productMap.get(String(t.productId || '').toLowerCase())
      || productMap.get(String(t.sku || '').toLowerCase())
      || productMap.get(String(t.productName || '').toLowerCase());

    const qty = Math.abs(Number(t.quantity) || 1);
    const unitCost = Number(t.costPerUnit || t.costPrice || p?.costPrice || (p?.price ? p.price * 0.6 : (Number(t.price) || 0) * 0.6));
    return sum + (qty * unitCost);
  }, 0);

  const realizedProfit = Math.round(recognizedRev - recognizedCOGS);
  const grossMarginPercent = recognizedRev > 0 ? Math.round((realizedProfit / recognizedRev) * 100) : 0;

  // Real, dynamic period-over-period comparison based on actual transaction timestamps
  const timestamps = salesTx.map(getTxTimestamp).filter(ts => ts > 0);
  let revChange = '0%';
  let isRevPositive = true;
  let ordersChange = '0%';
  let isOrdersPositive = true;

  if (timestamps.length > 0) {
    const maxTs = Math.max(...timestamps);
    const minTs = Math.min(...timestamps);
    const timeSpan = maxTs - minTs;
    const windowMs = timeSpan > 14 * 24 * 3600 * 1000 ? 14 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
    const currentPeriodStart = maxTs - windowMs;
    const priorPeriodStart = currentPeriodStart - windowMs;

    const currentFulfilled = fulfilledSalesTx.filter(t => getTxTimestamp(t) >= currentPeriodStart);
    const priorFulfilled = fulfilledSalesTx.filter(t => {
      const ts = getTxTimestamp(t);
      return ts >= priorPeriodStart && ts < currentPeriodStart;
    });

    const curRev = currentFulfilled.reduce((sum, t) => sum + Number(t.totalRevenue ?? ((t.price || 0) * (t.quantity || 1))), 0);
    const prevRev = priorFulfilled.reduce((sum, t) => sum + Number(t.totalRevenue ?? ((t.price || 0) * (t.quantity || 1))), 0);

    if (prevRev > 0) {
      const diff = Math.round(((curRev - prevRev) / prevRev) * 100);
      revChange = `${diff >= 0 ? '+' : ''}${diff}%`;
      isRevPositive = diff >= 0;
    } else if (curRev > 0) {
      revChange = '+100%';
      isRevPositive = true;
    }

    const currentSales = salesTx.filter(t => getTxTimestamp(t) >= currentPeriodStart);
    const priorSales = salesTx.filter(t => {
      const ts = getTxTimestamp(t);
      return ts >= priorPeriodStart && ts < currentPeriodStart;
    });

    const currentOrderIds = new Set(currentSales.map(t => t.orderNumber || t.orderId || t.id));
    const priorOrderIds = new Set(priorSales.map(t => t.orderNumber || t.orderId || t.id));

    const curOrders = currentOrderIds.size || currentSales.length;
    const prevOrders = priorOrderIds.size || priorSales.length;

    if (prevOrders > 0) {
      const diffOrders = Math.round(((curOrders - prevOrders) / prevOrders) * 100);
      ordersChange = `${diffOrders >= 0 ? '+' : ''}${diffOrders}%`;
      isOrdersPositive = diffOrders >= 0;
    } else if (curOrders > 0) {
      ordersChange = '+100%';
      isOrdersPositive = true;
    }
  }

  return [
    {
      key: 'revenue',
      title: 'Recognized Revenue',
      value: `${currencySymbol}${Math.round(recognizedRev).toLocaleString('en-IN')}`,
      rawValue: recognizedRev,
      change: revChange,
      isPositiveChange: isRevPositive,
      interpretation: recognizedRev > 0
        ? 'Realized on fulfilled & delivered orders.'
        : 'Awaiting fulfillment/delivery to recognize revenue.',
    },
    {
      key: 'pending_orders',
      title: 'Pending Orders (Pipeline)',
      value: `${currencySymbol}${Math.round(pendingOrderVal).toLocaleString('en-IN')}`,
      rawValue: pendingOrderVal,
      count: pendingOrderCount,
      change: `${pendingOrderCount} ${pendingOrderCount === 1 ? 'Order' : 'Orders'}`,
      isPositiveChange: true,
      interpretation: pendingOrderCount > 0
        ? `${pendingOrderCount} unfulfilled placed ${pendingOrderCount === 1 ? 'order' : 'orders'} in pipeline.`
        : 'Zero unfulfilled orders in queue.',
    },
    {
      key: 'total_orders',
      title: 'Total Orders',
      value: `${totalOrdersCount.toLocaleString('en-IN')}`,
      rawValue: totalOrdersCount,
      change: ordersChange,
      isPositiveChange: isOrdersPositive,
      interpretation: 'Confirmed orders across all sales channels.',
    },
    {
      key: 'net_profit',
      title: 'Realized Gross Profit',
      value: `${currencySymbol}${Math.round(realizedProfit).toLocaleString('en-IN')}`,
      rawValue: realizedProfit,
      change: `${grossMarginPercent}% Margin`,
      isPositiveChange: realizedProfit >= 0,
      interpretation: recognizedRev > 0
        ? `${grossMarginPercent}% gross margin on delivered sales (${currencySymbol}${Math.round(recognizedCOGS).toLocaleString('en-IN')} COGS).`
        : 'Calculated after COGS on delivered sales.',
    },
  ];
}

export interface ComputeInventoryQualityOptions {
  isDeadStockEnabled?: boolean;
  isVelocityEnabled?: boolean;
}

// 5. Detailed Inventory Quality Metrics
export function computeInventoryQuality(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  options?: ComputeInventoryQualityOptions
): InventoryQualityMetrics {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);

  const isDeadStockEnabled = options?.isDeadStockEnabled ?? true;
  const isVelocityEnabled = options?.isVelocityEnabled ?? true;

  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
  const criticalStockCount = products.filter(p => p.stock === 0).length;

  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStockCount = isDeadStockEnabled
    ? products.filter(p => p.stock > 0 && !saleProductIds.has(p.id)).length
    : 0;

  // Products with stock > minStock that are not dead stock are healthy stock
  const healthyCount = products.filter(p => {
    if (p.stock <= (p.minStock || 5)) return false;
    if (isDeadStockEnabled && !saleProductIds.has(p.id)) return false;
    return true;
  }).length;

  const fastMovingCount = isVelocityEnabled
    ? products.filter(p => (p.averageDailySales || 0) >= 1.5).length
    : 0;
  const slowMovingCount = isVelocityEnabled
    ? products.filter(p => (p.averageDailySales || 0) < 0.5 && p.stock > 0).length
    : 0;

  const topValuableProducts = [...products]
    .map(p => ({
      name: p.name || p.productName || 'Unnamed Product',
      sku: p.sku || 'N/A',
      value: Math.round(p.stock * p.price),
      stock: p.stock,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    healthyCount,
    lowStockCount,
    criticalStockCount,
    deadStockCount,
    fastMovingCount,
    slowMovingCount,
    recentlyAddedCount: Math.min(products.length, 5),
    topValuableProducts,
  };
}

// 6. Activity Event Stream
export function generateActivityEvents(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  rawSuppliers: Supplier[] = []
): ActivityEvent[] {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const suppliers = toDomainSuppliers(rawSuppliers);
  const events: ActivityEvent[] = [];

  transactions.slice(0, 4).forEach((t, i) => {
    const txDateStr = typeof t.transactionDate === 'string' ? t.transactionDate : '';
    events.push({
      id: `evt-tx-${t.id || i}`,
      title: t.type === 'Sale' ? `Recorded Customer Sale: ${t.productName || 'Product'}` : `Warehouse Stocking: ${t.productName || 'Product'}`,
      description: `Qty: ${t.quantity} • Value: ₹${(t.totalRevenue || (t.price || 0) * t.quantity || 0).toLocaleString('en-IN')}`,
      timestamp: txDateStr ? new Date(txDateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${i * 12 + 5}m ago`,
      type: t.type === 'Sale' ? 'sale' : 'order',
      iconName: t.type === 'Sale' ? 'ShoppingCart' : 'Package',
    });
  });

  if (events.length === 0) {
    events.push({
      id: 'evt-welcome',
      title: 'AI Business Command Center Active',
      description: 'Monitoring real-time inventory velocity & revenue trends.',
      timestamp: 'Just now',
      type: 'ai',
      iconName: 'Sparkles',
    });
  }

  return events;
}
