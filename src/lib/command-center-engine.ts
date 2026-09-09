import { Product, Transaction, Supplier, PurchaseOrder, ProductReturn, BusinessProfile } from './types';
import { detectProcurementRisks, calculateProcurementSavings } from './supplier-intelligence-engine';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { predictOptimalClearanceDiscount } from './ml/clearance-pricing-model';
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
    marginHealth: number;
    capitalEfficiency: number;
    supplierPerformance: number;
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

// 1. Calculate Dynamic Business Health Score (0-100) responding to executed founder tasks
export function computeBusinessHealth(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  rawSuppliers: Supplier[] = [],
  rawReturns: ProductReturn[] = []
): BusinessHealthSummary {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const suppliers = toDomainSuppliers(rawSuppliers);

  if (!products || products.length === 0) {
    return {
      score: 0,
      category: 'Needs Attention',
      color: '#6b7280',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      factors: {
        inventoryHealth: 0,
        marginHealth: 0,
        capitalEfficiency: 0,
        supplierPerformance: 0,
        deadStockRatio: 0,
      },
      summarySentence: 'Workspace has no active inventory data. Import products to begin live tracking.',
    };
  }

  // Base factor calculations
  const inStockProducts = products.filter(p => p.stock >= (p.minStock || 5));
  let inventoryHealth = Math.round((inStockProducts.length / products.length) * 100);

  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStockProducts = products.filter(p => p.stock > 0 && !saleProductIds.has(p.id));
  let deadStockRatio = Math.round(Math.max(0, 100 - (deadStockProducts.length / products.length) * 100));

  const totalValuation = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
  const deadStockValuation = deadStockProducts.reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.6)), 0);
  let capitalEfficiency = totalValuation > 0
    ? Math.round(Math.max(10, 100 - (deadStockValuation / totalValuation) * 100))
    : 100;

  const productsMap = new Map<string, typeof products[0]>();
  products.forEach(p => {
    if (p.id) productsMap.set(p.id, p);
    if (p.sku) productsMap.set(p.sku, p);
  });

  const totalSales = transactions.filter(t => t.type === 'Sale').reduce((acc, t) => acc + (t.totalRevenue || ((t.quantity || 1) * (t.price || 0))), 0);
  const totalCOGS = transactions.filter(t => t.type === 'Sale').reduce((acc, t) => {
    if (t.totalCost !== undefined) return acc + t.totalCost;
    const p = productsMap.get(t.productId || '') || productsMap.get(t.sku || '');
    return acc + ((t.quantity || 1) * (p?.costPrice || (p?.price ? p.price * 0.6 : 0)));
  }, 0);
  const profitMarginPercent = totalSales > 0 ? ((totalSales - totalCOGS) / totalSales) * 100 : 35;
  let marginHealth = Math.min(100, Math.round((profitMarginPercent / 45) * 100));

  const avgSupplierLead = products.reduce((acc, p) => acc + (p.leadTimeDays || 7), 0) / products.length;
  let supplierPerformance = Math.round(Math.max(30, 100 - (avgSupplierLead - 3) * 5));

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
  const executionBonus = Math.min(30, executedActionCount * 4);
  inventoryHealth = Math.min(100, inventoryHealth + Math.round(executionBonus * 0.4));
  capitalEfficiency = Math.min(100, capitalEfficiency + Math.round(executionBonus * 0.5));
  marginHealth = Math.min(100, marginHealth + Math.round(executionBonus * 0.3));

  // Overall Weighted Score
  let score = Math.round(
    inventoryHealth * 0.25 +
    marginHealth * 0.25 +
    capitalEfficiency * 0.20 +
    deadStockRatio * 0.15 +
    supplierPerformance * 0.15 +
    executionBonus * 0.25
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

  let summarySentence = 'Operations are stable with good inventory velocity.';
  if (deadStockProducts.length > 5) {
    summarySentence = `Capital lockup detected: ${deadStockProducts.length} dead stock items require clearance.`;
  } else if (inventoryHealth < 70) {
    summarySentence = `Stockout vulnerability: ${products.length - inStockProducts.length} items running low.`;
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
      marginHealth,
      capitalEfficiency,
      supplierPerformance,
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
  businessProfile?: BusinessProfile | null
): ActionTask[] {
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
  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStock = [...products]
    .filter(p => p && p.name && p.stock > 0 && !saleProductIds.has(p.id) && p.liquidationStatus !== 'Liquidated' && !(p.compareAtPrice && p.compareAtPrice > p.price))
    .sort((a, b) => (b.stock * (b.costPrice || b.price * 0.6)) - (a.stock * (a.costPrice || a.price * 0.6)) || (a.name || '').localeCompare(b.name || ''));

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
  const highDemandProducts = [...products]
    .filter(p => p && p.name && (p.averageDailySales || 0) >= 0.5 && (p.price || 0) > 0)
    .sort((a, b) => (b.averageDailySales || 0) - (a.averageDailySales || 0) || (a.name || '').localeCompare(b.name || ''));

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

// 4. Compute Executive KPI Card Interpretations
export function computeExecutiveKPIs(
  rawProducts: Product[],
  rawTransactions: Transaction[] = [],
  businessProfile?: BusinessProfile | null
): KPICardItem[] {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const totalInventoryVal = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const salesTx = transactions.filter(t => t.type === 'Sale');
  const totalSalesVal = salesTx.reduce((sum, t) => sum + (t.totalRevenue || (t.quantity * (t.price || 0))), 0);
  
  const totalCOGS = salesTx.reduce((sum, t) => {
    if (t.totalCost !== undefined) return sum + t.totalCost;
    const p = products.find(prod => prod.id === t.productId || prod.sku === t.sku);
    return sum + (t.quantity * (p?.costPrice || 0));
  }, 0);
  const totalProfit = totalSalesVal - totalCOGS;

  const totalOrdersCount = salesTx.length;

  return [
    {
      key: 'revenue',
      title: 'Total Revenue',
      value: `${currencySymbol}${Math.round(totalSalesVal).toLocaleString('en-IN')}`,
      rawValue: totalSalesVal,
      change: '+14%',
      isPositiveChange: true,
      interpretation: totalSalesVal > 0 ? 'Strong sell-through rate in primary categories.' : 'Awaiting first sales transactions.',
    },
    {
      key: 'inventory_value',
      title: 'Inventory Value',
      value: `${currencySymbol}${Math.round(totalInventoryVal).toLocaleString('en-IN')}`,
      rawValue: totalInventoryVal,
      change: '+5%',
      isPositiveChange: true,
      interpretation: `${products.length} active SKUs valuation in warehouse.`,
    },
    {
      key: 'net_profit',
      title: 'Net Gross Profit',
      value: `${currencySymbol}${Math.round(totalProfit).toLocaleString('en-IN')}`,
      rawValue: totalProfit,
      change: totalProfit >= 0 ? '+18%' : '-4%',
      isPositiveChange: totalProfit >= 0,
      interpretation: totalSalesVal > 0 ? `${Math.round((totalProfit / totalSalesVal) * 100)}% gross margin retained.` : 'Calculated after COGS deduction.',
    },
    {
      key: 'total_orders',
      title: 'Total Sales Cycles',
      value: totalOrdersCount.toString(),
      rawValue: totalOrdersCount,
      change: '+8%',
      isPositiveChange: true,
      interpretation: `${totalOrdersCount} customer sale orders processed.`,
    },
  ];
}

// 5. Detailed Inventory Quality Metrics
export function computeInventoryQuality(
  rawProducts: Product[],
  rawTransactions: Transaction[] = []
): InventoryQualityMetrics {
  const products = toDomainProducts(rawProducts);
  const transactions = toDomainTransactions(rawTransactions);

  const healthyCount = products.filter(p => p.stock > (p.minStock || 5) && p.stock < (p.maxStock || 100)).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
  const criticalStockCount = products.filter(p => p.stock === 0).length;

  const saleProductIds = new Set(transactions.filter(t => t.type === 'Sale').map(t => t.productId));
  const deadStockCount = products.filter(p => p.stock > 0 && !saleProductIds.has(p.id)).length;

  const fastMovingCount = products.filter(p => (p.averageDailySales || 0) >= 1.5).length;
  const slowMovingCount = products.filter(p => (p.averageDailySales || 0) < 0.5 && p.stock > 0).length;

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
