import { Product, Transaction, Supplier, ProductReturn } from './types';
import { calculateSupplierPerformanceScore, calculateSupplierCostIntelligence } from './supplier-intelligence-engine';
import { calculateProductVelocity, forecastProductDemand, projectStockoutDate } from './forecasting-engine';

export type ProductHealthStatus =
  | 'Excellent'
  | 'Healthy'
  | 'Low Stock'
  | 'Critical Stock'
  | 'Out of Stock'
  | 'Overstocked'
  | 'Dead Stock'
  | 'Fast Moving'
  | 'Slow Moving'
  | 'Unsold'
  | 'Trending'
  | 'Discontinued Candidate';

export type ProductGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ProductIntelligenceReport {
  healthStatus: ProductHealthStatus;
  healthColor: string;
  badgeClass: string;
  performanceGrade: ProductGrade;
  performanceScore: number; // 0 - 100
  daysOfStockRemaining: number;
  averageDailySales: number;
  profitMarginPercent: number;
  demandTrend: 'Growing' | 'Stable' | 'Declining' | 'Seasonal' | 'Spike';
  demandTrendColor: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskReason: string;
  reorderAdvice: {
    needed: boolean;
    suggestedQty: number;
    urgency: 'High' | 'Medium' | 'Low';
    reason: string;
    financialRunwayImpact: number;
  };
  opportunityAdvice: {
    hasOpportunity: boolean;
    type: 'price_increase' | 'clearance' | 'bundle' | 'reorder';
    title: string;
    description: string;
    estimatedValue: number;
    targetPrice?: number;
  };
  tags: string[];
  executiveSummary: string;
  supplierIntelligence?: {
    supplierName: string;
    supplierId?: string;
    supplierScore: number | null;
    supplierStatus: string;
    leadTimeDays: number;
    onTimeDeliveryRate: number | null;
    isSingleSupplierDependency: boolean;
    costTrendPercent: number;
    marginImpactPercentagePoints: number;
  };
  forecastingProfile?: {
    forecast30Days: number;
    velocityChangePercent: number;
    projectedStockoutDate: string | null;
    daysRemaining: number | null;
    stockoutRiskLevel: string;
    forecastConfidence: string;
  };
}

export interface ComputeProductIntelligenceOptions {
  isDeadStockEnabled?: boolean;
  isVelocityEnabled?: boolean;
  historicalDays?: number;
}

// 1. Calculate Full Product Intelligence Report
export function computeProductIntelligence(
  product: Product,
  allTransactions: Transaction[] = [],
  allReturns: ProductReturn[] = [],
  allSuppliers: Supplier[] = [],
  options?: ComputeProductIntelligenceOptions
): ProductIntelligenceReport {
  const productName = product?.name || product?.productName || product?.title || 'Selected Product';
  const stock = product?.stock !== undefined && !isNaN(product.stock) ? product.stock : 0;

  const isDeadStockEnabled = options?.isDeadStockEnabled ?? true;
  const isVelocityEnabled = options?.isVelocityEnabled ?? true;

  const pTx = allTransactions.filter(
    t => t.type === 'Sale' && (t.productId === product?.id || t.sku === product?.sku || (t.productName && product?.name && t.productName.toLowerCase() === product.name.toLowerCase()))
  );

  const totalSoldQty = pTx.reduce((sum, t) => sum + (t.quantity || 0), 0);

  const costPrice = product?.costPrice && product.costPrice > 0 ? product.costPrice : (product?.price ? product.price * 0.6 : 100);
  const sellingPrice = product?.price && product.price > 0 ? product.price : (costPrice ? costPrice * 1.5 : 150);
  const unitProfit = sellingPrice - costPrice;
  const profitMarginPercent = sellingPrice > 0 ? Math.round((unitProfit / sellingPrice) * 100) : 35;

  // Daily Sales Velocity: If an item has 0 confirmed sales in transactions, its daily sales in this dataset is 0.
  // Never inherit mock/fallback values when zero sales have actually taken place.
  const dailySales = totalSoldQty > 0
    ? (product?.averageDailySales && product.averageDailySales > 0
        ? product.averageDailySales
        : Math.max(0.1, totalSoldQty / Math.max(1, options?.historicalDays || 30)))
    : 0;

  // Days of Stock Remaining
  const daysOfStockRemaining = dailySales > 0 ? Math.round(stock / dailySales) : (stock > 0 ? 999 : 0);

  // Reorder Advice with Calibrated Target Runway Band (28-35 Days)
  const leadTime = product?.leadTimeDays || 7;
  const isReorderNeeded = stock === 0 || stock <= (product?.minStock || 5) || (dailySales > 0 && daysOfStockRemaining <= leadTime + 3);
  const targetBufferDays = Math.max(leadTime + 14, 28); // 4 weeks of runway
  const targetOptimalStock = Math.ceil(dailySales > 0 ? dailySales * targetBufferDays : (product?.minStock || 5) * 3);
  const suggestedQty = isReorderNeeded ? Math.max(10, Math.ceil(targetOptimalStock - stock)) : 0;
  const runwayImpact = Math.round(sellingPrice * (suggestedQty || 15));

  // Determine Health Status based on actual mathematical runway
  let healthStatus: ProductHealthStatus = 'Healthy';
  let healthColor = '#10b981';
  let badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm';
  const hasSalesHistory = totalSoldQty > 0;

  if (stock === 0) {
    healthStatus = 'Out of Stock';
    healthColor = '#ef4444';
    badgeClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold shadow-sm';
  } else if (isReorderNeeded) {
    healthStatus = 'Low Stock';
    healthColor = '#f59e0b';
    badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold shadow-sm';
  } else if (!hasSalesHistory) {
    // If dead stock detection is disabled (e.g. in learning mode, < 30 days history):
    // Zero-sale items are NOT dead stock; they are simply in-cycle catalog items.
    if (isDeadStockEnabled) {
      healthStatus = 'Dead Stock';
      healthColor = '#94a3b8';
      badgeClass = 'bg-slate-400/20 text-slate-200 border border-slate-400/40 font-bold shadow-sm';
    } else {
      healthStatus = 'Healthy';
      healthColor = '#10b981';
      badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm';
    }
  } else if (daysOfStockRemaining > 120 && stock > 80 && dailySales < 0.8 && isVelocityEnabled) {
    // Only flag Overstocked when stock exceeds 4 full months of demand on a slow item
    healthStatus = 'Overstocked';
    healthColor = '#3b82f6';
    badgeClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold shadow-sm';
  } else if (dailySales >= 2.0 && isVelocityEnabled && totalSoldQty >= 10) {
    healthStatus = 'Fast Moving';
    healthColor = '#10b981';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm';
  } else if (dailySales >= 1.0 && isVelocityEnabled && totalSoldQty >= 5) {
    healthStatus = 'Trending';
    healthColor = '#10b981';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm';
  } else if (dailySales < 0.3 && totalSoldQty > 0 && isVelocityEnabled) {
    healthStatus = 'Slow Moving';
    healthColor = '#94a3b8';
    badgeClass = 'bg-slate-400/20 text-slate-200 border border-slate-400/40 font-bold shadow-sm';
  } else {
    healthStatus = 'Healthy';
    healthColor = '#10b981';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold shadow-sm';
  }

  // Calculate Performance Score (0 - 100) & Grade
  const salesScore = Math.min(40, totalSoldQty * 2);
  const marginScore = Math.min(30, (profitMarginPercent / 50) * 30);
  const availabilityScore = stock > 0 ? 20 : 0;
  const turnoverScore = dailySales > 0.5 ? 10 : 5;

  const performanceScore = Math.min(100, Math.round(salesScore + marginScore + availabilityScore + turnoverScore));

  let performanceGrade: ProductGrade = 'B';
  if (performanceScore >= 90) performanceGrade = 'A+';
  else if (performanceScore >= 75) performanceGrade = 'A';
  else if (performanceScore >= 60) performanceGrade = 'B';
  else if (performanceScore >= 45) performanceGrade = 'C';
  else if (performanceScore >= 30) performanceGrade = 'D';
  else performanceGrade = 'F';

  // Demand Trend
  let demandTrend: ProductIntelligenceReport['demandTrend'] = 'Stable';
  let demandTrendColor = '#3b82f6';
  if (dailySales >= 2.0) {
    demandTrend = 'Spike';
    demandTrendColor = '#10b981';
  } else if (dailySales >= 1.0) {
    demandTrend = 'Growing';
    demandTrendColor = '#22c55e';
  } else if (dailySales < 0.3 && totalSoldQty > 0) {
    demandTrend = 'Declining';
    demandTrendColor = '#f97316';
  }

  // Risk Assessment
  let riskLevel: ProductIntelligenceReport['riskLevel'] = 'Low';
  let riskReason = 'Operations stable with healthy inventory runway.';
  if (stock === 0) {
    riskLevel = 'Critical';
    riskReason = 'Out of stock! Customers cannot purchase this item.';
  } else if (isReorderNeeded) {
    riskLevel = 'High';
    riskReason = `Stock level (${stock} units) will last ~${daysOfStockRemaining} days, below the supplier lead time window (${leadTime} days). Imminent stockout risk.`;
  } else if (healthStatus === 'Dead Stock') {
    riskLevel = 'Medium';
    riskReason = 'Capital lockup! Item has zero sales velocity and is occupying shelf space.';
  } else if (profitMarginPercent < 15) {
    riskLevel = 'Medium';
    riskReason = 'Low profit margin! Selling price is close to cost price.';
  }

  const reorderAdvice = {
    needed: isReorderNeeded,
    suggestedQty: suggestedQty,
    urgency: stock === 0 ? ('High' as const) : (isReorderNeeded ? ('High' as const) : ('Low' as const)),
    reason: isReorderNeeded
      ? `Current stock (${stock} units) will last ~${daysOfStockRemaining} days. Reordering ${suggestedQty} units establishes a healthy ${targetBufferDays}-day runway.`
      : `Current stock level is sufficient for ${daysOfStockRemaining} days.`,
    financialRunwayImpact: runwayImpact,
  };

  // Opportunity Advice
  let opportunityAdvice: ProductIntelligenceReport['opportunityAdvice'] = {
    hasOpportunity: false,
    type: 'reorder',
    title: 'Maintain Current Operations',
    description: 'No urgent price adjustments or promotions needed.',
    estimatedValue: 0,
  };

  if (healthStatus === 'Dead Stock') {
    const tied = Math.round(stock * costPrice * 0.8);
    const clearancePrice = Math.max(1, Math.round(sellingPrice * 0.8));
    opportunityAdvice = {
      hasOpportunity: true,
      type: 'clearance',
      title: 'Launch 20% Clearance Discount',
      description: `Clear stagnant inventory at ₹${clearancePrice.toLocaleString('en-IN')} to unlock tied working capital.`,
      estimatedValue: tied,
      targetPrice: clearancePrice,
    };
  } else if (sellingPrice < costPrice || profitMarginPercent <= 0) {
    // Loss-making / heavily underpriced product: suggest realistic cost-plus pricing
    const targetPrice = Math.round(costPrice * 1.3); // 30% margin
    const addedProfit = Math.round((targetPrice - sellingPrice) * (stock || 20));
    opportunityAdvice = {
      hasOpportunity: true,
      type: 'price_increase',
      title: 'Correct Below-Cost Price',
      description: `Selling price (₹${sellingPrice.toLocaleString('en-IN')}) is below unit cost (₹${Math.round(costPrice).toLocaleString('en-IN')}). Adjust price to ₹${targetPrice.toLocaleString('en-IN')} to achieve a 30% margin.`,
      estimatedValue: addedProfit,
      targetPrice: targetPrice,
    };
  } else if (dailySales >= 1.5 && profitMarginPercent < 25 && profitMarginPercent > 0) {
    // Profitable item with high demand but sub-optimal margin (< 25%): expand margin
    const newPrice = Math.max(sellingPrice + 10, Math.round(sellingPrice * 1.08));
    const addedProfit = Math.round((newPrice - sellingPrice) * (stock || 20));
    opportunityAdvice = {
      hasOpportunity: true,
      type: 'price_increase',
      title: 'Optimize Price (+8%)',
      description: `High sales velocity (${dailySales}/day) allows increasing price from ₹${sellingPrice.toLocaleString('en-IN')} to ₹${newPrice.toLocaleString('en-IN')} to reach a 25%+ healthy margin.`,
      estimatedValue: addedProfit,
      targetPrice: newPrice,
    };
  }

  // Tags: Strict validation against ground-truth volume and mutual exclusivity
  const tags: string[] = [];
  const isBestSeller = totalSoldQty >= 25 || (dailySales >= 1.5 && totalSoldQty >= 10 && isVelocityEnabled);
  const isTrending = dailySales >= 1.0 && totalSoldQty >= 5 && isVelocityEnabled;

  if (isBestSeller && healthStatus !== 'Dead Stock') tags.push('Best Seller');
  if (isTrending && healthStatus !== 'Dead Stock' && !tags.includes('Best Seller')) tags.push('Trending');
  if (profitMarginPercent >= 45) tags.push('High Margin');
  if (profitMarginPercent < 20) tags.push('Low Margin');
  if (healthStatus === 'Dead Stock' && isDeadStockEnabled) tags.push('Dead Stock');
  if (isReorderNeeded) tags.push('Reorder Soon');
  if (healthStatus === 'Overstocked') tags.push('Overstock');
  if (opportunityAdvice.type === 'price_increase' && totalSoldQty >= 5) tags.push('Price Up Candidate');

  // Executive Summary with robust product name resolution
  let executiveSummary = `${productName} holds a Performance Grade of ${performanceGrade}. `;
  if (isReorderNeeded) {
    executiveSummary += `Stock level (${stock} units) is critical; reorder ${suggestedQty} units immediately to protect ₹${runwayImpact.toLocaleString('en-IN')} revenue runway.`;
  } else if (healthStatus === 'Dead Stock') {
    executiveSummary += `Item has zero recorded sales, locking up ₹${Math.round(stock * costPrice).toLocaleString('en-IN')} in working capital. Launch a clearance promo.`;
  } else {
    executiveSummary += `Demand is ${demandTrend.toLowerCase()} with a healthy profit margin of ${profitMarginPercent}%. Maintain purchasing priority.`;
  }

  // Supplier Intelligence Integration
  let supplierIntelligence: ProductIntelligenceReport['supplierIntelligence'] = undefined;
  if (product?.supplier) {
    const matchedSup = allSuppliers.find(s => s.name === product.supplier || s.id === product.supplierId) || {
      id: product.supplierId || 'sup-1',
      name: product.supplier,
      contactName: '',
      email: '',
      phone: '',
      address: '',
      createdAt: '',
      updatedAt: '',
    };

    const supPerf = calculateSupplierPerformanceScore(matchedSup as Supplier, [], [product], allTransactions);
    const costItem = calculateSupplierCostIntelligence(product, matchedSup as Supplier, [], allTransactions);

    supplierIntelligence = {
      supplierName: matchedSup.name,
      supplierId: matchedSup.id,
      supplierScore: supPerf.score,
      supplierStatus: supPerf.status,
      leadTimeDays: supPerf.avgLeadTimeDays || product.leadTimeDays || 5,
      onTimeDeliveryRate: supPerf.onTimeDeliveryRate,
      isSingleSupplierDependency: true,
      costTrendPercent: costItem.costChangePercent,
      marginImpactPercentagePoints: costItem.marginImpactPercentagePoints,
    };
  }

  // Calculate Product Forecasting Profile
  const prodVelocity = calculateProductVelocity(product, allTransactions);
  const prodDemandForecast = forecastProductDemand(product, prodVelocity, allTransactions);
  const prodStockoutProj = projectStockoutDate(product, prodVelocity, allSuppliers);

  const forecastingProfile = {
    forecast30Days: prodDemandForecast.forecast30Days,
    velocityChangePercent: prodVelocity.velocityChangePercent,
    projectedStockoutDate: prodStockoutProj.projectedStockoutDate,
    daysRemaining: prodStockoutProj.daysRemaining,
    stockoutRiskLevel: prodStockoutProj.stockoutRiskLevel,
    forecastConfidence: prodDemandForecast.confidence,
  };

  return {
    healthStatus,
    healthColor,
    badgeClass,
    performanceGrade,
    performanceScore,
    daysOfStockRemaining,
    averageDailySales: Number(dailySales.toFixed(1)),
    profitMarginPercent,
    demandTrend,
    demandTrendColor,
    riskLevel,
    riskReason,
    reorderAdvice,
    opportunityAdvice,
    tags,
    executiveSummary,
    supplierIntelligence,
    forecastingProfile,
  };
}

// 2. High-Precision Natural Language Inventory Search Engine
export function filterProductsByNaturalLanguage(
  products: Product[],
  transactions: Transaction[] = [],
  query: string
): Product[] {
  if (!query || !query.trim()) return products;

  const q = query.toLowerCase().trim();

  // Create set of product IDs that have recorded sales transactions
  const saleProductIds = new Set(
    (transactions || [])
      .filter(t => t && t.type === 'Sale' && (t.quantity || 0) > 0)
      .map(t => t.productId)
  );

  // Query 1: "dead stock" | "unsold" | "stagnant" | "no sales"
  if (
    q.includes('dead stock') ||
    q.includes('dead') ||
    q.includes('unsold') ||
    q.includes('stagnant') ||
    q.includes('no sales')
  ) {
    const deadStockItems = products.filter(p => {
      if (!p || (p.stock || 0) <= 0) return false;
      const isIdSold = p.id ? saleProductIds.has(p.id) : false;
      return !isIdSold || (p.averageDailySales !== undefined && p.averageDailySales === 0);
    });

    // Fallback if strict zero-sales yields empty but catalog has slow moving items
    if (deadStockItems.length === 0) {
      return [...products]
        .filter(p => p && (p.stock || 0) > 0)
        .sort((a, b) => (a.averageDailySales || 0) - (b.averageDailySales || 0));
    }

    return deadStockItems.sort((a, b) => (b.stock * (b.costPrice || b.price * 0.6)) - (a.stock * (a.costPrice || a.price * 0.6)));
  }

  // Query 2: "running out soon" | "running out" | "low stock" | "out of stock" | "critical stock" | "reorder"
  if (
    q.includes('running out') ||
    q.includes('low stock') ||
    q.includes('out of stock') ||
    q.includes('critical') ||
    q.includes('reorder')
  ) {
    return products
      .filter(p => {
        if (!p) return false;
        const stock = p.stock || 0;
        const minStock = p.minStock || 5;
        const ads = p.averageDailySales || 0.1;
        const runway = stock / ads;
        return stock <= minStock || stock === 0 || runway <= 14;
      })
      .sort((a, b) => (a.stock / (a.minStock || 5)) - (b.stock / (b.minStock || 5)));
  }

  // Query 3: "highest margins" | "high margin" | "most profitable" | "profitable" | "best margin"
  if (
    q.includes('highest margin') ||
    q.includes('high margin') ||
    q.includes('most profitable') ||
    q.includes('profitable') ||
    q.includes('best margin')
  ) {
    return [...products].sort((a, b) => {
      const costA = a.costPrice && a.costPrice > 0 ? a.costPrice : a.price * 0.6;
      const marginA = a.price > 0 ? ((a.price - costA) / a.price) : 0.35;

      const costB = b.costPrice && b.costPrice > 0 ? b.costPrice : b.price * 0.6;
      const marginB = b.price > 0 ? ((b.price - costB) / b.price) : 0.35;

      return marginB - marginA;
    });
  }

  // Query 4: "low margin (<20%)" | "low margin" | "low profit" | "less than 20" | "20%" | "<20%"
  if (
    q.includes('low margin') ||
    q.includes('low profit') ||
    q.includes('less than 20') ||
    q.includes('20%') ||
    q.includes('<20')
  ) {
    return products.filter(p => {
      if (!p || !p.price || p.price <= 0) return false;
      const cost = p.costPrice && p.costPrice > 0 ? p.costPrice : p.price * 0.6;
      const marginPercent = ((p.price - cost) / p.price) * 100;
      return marginPercent < 25;
    });
  }

  // Query 5: "overstocked" | "excess stock" | "too much stock" | "bulk stock"
  if (
    q.includes('overstocked') ||
    q.includes('excess stock') ||
    q.includes('too much stock') ||
    q.includes('bulk stock')
  ) {
    return products.filter(p => {
      if (!p) return false;
      const stock = p.stock || 0;
      const maxStock = p.maxStock || 100;
      const ads = p.averageDailySales || 0.5;
      const runway = stock / ads;
      return stock >= maxStock || runway >= 45;
    });
  }

  // Query 6: "fast moving" | "best seller" | "trending"
  if (
    q.includes('fast moving') ||
    q.includes('best seller') ||
    q.includes('trending')
  ) {
    return products.filter(p => (p.averageDailySales || 0) >= 0.8);
  }

  // Standard Keyword Match (Name, SKU, Brand, Category, Supplier)
  return products.filter(p => {
    if (!p) return false;
    const nameMatch = (p.name || p.productName || '').toLowerCase().includes(q);
    const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
    const brandMatch = p.brand ? p.brand.toLowerCase().includes(q) : false;
    const supplierMatch = p.supplier ? p.supplier.toLowerCase().includes(q) : false;
    const categoryMatch = p.categoryId ? p.categoryId.toLowerCase().includes(q) : false;
    return nameMatch || skuMatch || brandMatch || supplierMatch || categoryMatch;
  });
}
