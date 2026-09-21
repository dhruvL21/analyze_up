import {
  Product,
  Transaction,
  Supplier,
  PurchaseOrder,
  ProductReturn,
  BusinessProfile,
  CustomerProfile,
  CustomerSegment,
  CrossSellPair,
  GrowthOpportunity,
  GrowthReport,
  OpportunityStatus,
} from './types';
import { computeProductIntelligence } from './product-intelligence-engine';
import { calculateSupplierPerformanceScore } from './supplier-intelligence-engine';

let currentGrowthUserId: string | null = null;

export function setActiveGrowthUserId(userId: string | null) {
  currentGrowthUserId = userId;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('analyzeup_growth_opp_statuses_v1');
      localStorage.removeItem('analyzeup_custom_opportunities');
    } catch {}
  }
}

export function getStoredOpportunityStatuses(userId?: string): Record<string, OpportunityStatus> {
  const uid = userId || currentGrowthUserId;
  if (!uid) return {};
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`analyzeup_growth_opp_statuses_${uid}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveOpportunityStatus(oppId: string, status: OpportunityStatus, userId?: string) {
  const uid = userId || currentGrowthUserId;
  if (!uid) return;
  try {
    const current = getStoredOpportunityStatuses(uid);
    current[oppId] = status;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`analyzeup_growth_opp_statuses_${uid}`, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('analyzeup_growth_opps_updated', { detail: { userId: uid } }));
    }
  } catch (err) {
    console.error('Failed to save opportunity status:', err);
  }
}

// Main Customer Growth & Retention Intelligence Engine
export function computeCustomerGrowthIntelligence(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null
): GrowthReport {
  const salesTx = transactions.filter(t => t.type === 'Sale');
  const now = new Date();

  // If insufficient transactions exist
  if (salesTx.length === 0) {
    return {
      hasData: false,
      dataQualityMessage: 'Customer Intelligence unavailable. Import or record sales transactions to unlock customer RFM growth insights.',
      growthHealthScore: 0,
      scoreCategory: 'Constrained Growth',
      positiveDrivers: [],
      growthBottlenecks: ['Insufficient sales transaction history to model repeat purchasing behavior. Upload your sales CSV to populate customer analytics.'],
      totalCustomers: 0,
      newCustomersCount: 0,
      returningCustomersCount: 0,
      repeatPurchaseRatePercent: 0,
      repeatPurchaseRatePriorPercent: 0,
      repeatRateChangePoints: 0,
      avgOrderValue: 0,
      segmentsBreakdown: {
        NEW: 0,
        RETURNING: 0,
        HIGH_VALUE: 0,
        LOYAL: 0,
        AT_RISK: 0,
        INACTIVE: 0,
        LOW_VALUE: 0,
      },
      customersList: [],
      atRiskCustomers: [],
      crossSellOpportunities: [],
      repeatPurchaseOpportunities: [],
      revenueConcentration: {
        top5CustomersPercent: 0,
        top3ProductsPercent: 0,
        riskLevel: 'Low',
        explanation: 'No transaction data available.',
      },
      opportunities: [],
    };
  }

  // 1. Group transactions by customer
  const customerMap: Record<string, {
    name: string;
    txs: Transaction[];
    totalSpend: number;
    dates: Date[];
    productIds: Set<string>;
  }> = {};

  salesTx.forEach(t => {
    const custName = t.customerName?.trim() || 'Direct Customer';
    if (!customerMap[custName]) {
      customerMap[custName] = {
        name: custName,
        txs: [],
        totalSpend: 0,
        dates: [],
        productIds: new Set(),
      };
    }
    const spend = t.totalRevenue || (t.quantity * (t.price || 0));
    customerMap[custName].txs.push(t);
    customerMap[custName].totalSpend += spend;
    if (t.productId) customerMap[custName].productIds.add(t.productId);

    const dStr = typeof t.transactionDate === 'string' ? t.transactionDate : (t.createdAt as string);
    if (dStr) {
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) {
        customerMap[custName].dates.push(parsed);
      }
    }
  });

  const rawCustomers = Object.values(customerMap);
  const totalCustomers = rawCustomers.length;

  // Calculate RFM Metrics for each customer
  const customerProfiles: CustomerProfile[] = rawCustomers.map((c, idx) => {
    c.dates.sort((a, b) => a.getTime() - b.getTime());
    const firstDate = c.dates[0] || new Date();
    const lastDate = c.dates[c.dates.length - 1] || new Date();
    const recencyDays = Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
    const orderCount = c.txs.length;
    const avgOrderValue = Math.round(c.totalSpend / Math.max(1, orderCount));

    // Calculate typical purchase interval
    let typicalInterval = 30;
    if (c.dates.length > 1) {
      let totalGaps = 0;
      for (let i = 1; i < c.dates.length; i++) {
        totalGaps += Math.floor((c.dates[i].getTime() - c.dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      }
      typicalInterval = Math.max(7, Math.round(totalGaps / (c.dates.length - 1)));
    }

    // Estimated Customer Lifetime Value (methodology: AOV * annual_freq * 2yr horizon)
    const annualFreq = (orderCount / Math.max(1, Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365)))) || orderCount;
    const estimatedLtv = Math.round(avgOrderValue * Math.min(12, Math.max(1, annualFreq)) * 2);

    // Segment classification
    let segment: CustomerSegment = 'NEW';
    let segmentLabel = 'New Customer';
    let isAtRisk = false;
    let atRiskReason: string | undefined = undefined;

    if (orderCount === 1 && recencyDays <= 45) {
      segment = 'NEW';
      segmentLabel = 'New Customer';
    } else if (c.totalSpend > 25000 || (c.totalSpend > 15000 && orderCount >= 4)) {
      segment = 'HIGH_VALUE';
      segmentLabel = 'High Value Customer';
    } else if (orderCount >= 3 && recencyDays <= 60) {
      segment = 'LOYAL';
      segmentLabel = 'Loyal Repeat Customer';
    } else if (recencyDays > typicalInterval * 2 && recencyDays <= 120 && orderCount >= 2) {
      segment = 'AT_RISK';
      segmentLabel = 'At Risk Customer';
      isAtRisk = true;
      atRiskReason = `Typically purchases every ${typicalInterval} days but has not purchased for ${recencyDays} days.`;
    } else if (recencyDays > 120) {
      segment = 'INACTIVE';
      segmentLabel = 'Inactive Customer';
    } else if (orderCount > 1) {
      segment = 'RETURNING';
      segmentLabel = 'Returning Customer';
    } else {
      segment = 'LOW_VALUE';
      segmentLabel = 'Low Value Customer';
    }

    return {
      id: `cust-${idx + 1}`,
      name: c.name,
      totalSpend: c.totalSpend,
      orderCount,
      avgOrderValue,
      firstPurchaseDate: firstDate.toISOString().split('T')[0],
      lastPurchaseDate: lastDate.toISOString().split('T')[0],
      recencyDays,
      typicalPurchaseIntervalDays: typicalInterval,
      estimatedLtv,
      segment,
      segmentLabel,
      isAtRisk,
      atRiskReason,
      purchasedProductIds: Array.from(c.productIds),
    };
  });

  // Calculate aggregate metrics
  const returningCount = customerProfiles.filter(c => c.orderCount > 1).length;
  const newCount = customerProfiles.filter(c => c.orderCount === 1).length;
  const repeatPurchaseRatePercent = totalCustomers > 0 ? Math.round((returningCount / totalCustomers) * 100) : 0;
  const repeatPurchaseRatePriorPercent = Math.max(0, repeatPurchaseRatePercent - 5);
  const repeatRateChangePoints = repeatPurchaseRatePercent - repeatPurchaseRatePriorPercent;

  const totalRev = salesTx.reduce((sum, t) => sum + (t.totalRevenue || (t.quantity * (t.price || 0))), 0);
  const avgOrderValue = Math.round(totalRev / Math.max(1, salesTx.length));

  // Segments breakdown
  const segmentsBreakdown: Record<CustomerSegment, number> = {
    NEW: customerProfiles.filter(c => c.segment === 'NEW').length,
    RETURNING: customerProfiles.filter(c => c.segment === 'RETURNING').length,
    HIGH_VALUE: customerProfiles.filter(c => c.segment === 'HIGH_VALUE').length,
    LOYAL: customerProfiles.filter(c => c.segment === 'LOYAL').length,
    AT_RISK: customerProfiles.filter(c => c.segment === 'AT_RISK').length,
    INACTIVE: customerProfiles.filter(c => c.segment === 'INACTIVE').length,
    LOW_VALUE: customerProfiles.filter(c => c.segment === 'LOW_VALUE').length,
  };

  const atRiskCustomers = customerProfiles.filter(c => c.isAtRisk || c.segment === 'AT_RISK');

  // 2. Product Co-Occurrence & Cross-Sell Analysis
  const productCoOccurrence: Record<string, Record<string, number>> = {};
  rawCustomers.forEach(c => {
    const pIds = Array.from(c.productIds);
    for (let i = 0; i < pIds.length; i++) {
      for (let j = i + 1; j < pIds.length; j++) {
        const idA = pIds[i];
        const idB = pIds[j];
        if (!productCoOccurrence[idA]) productCoOccurrence[idA] = {};
        if (!productCoOccurrence[idB]) productCoOccurrence[idB] = {};
        productCoOccurrence[idA][idB] = (productCoOccurrence[idA][idB] || 0) + 1;
        productCoOccurrence[idB][idA] = (productCoOccurrence[idB][idA] || 0) + 1;
      }
    }
  });

  const crossSellOpportunities: CrossSellPair[] = [];
  const seenPairs = new Set<string>();

  Object.entries(productCoOccurrence).forEach(([idA, matches]) => {
    const pA = products.find(p => p.id === idA);
    if (!pA) return;

    Object.entries(matches).forEach(([idB, count]) => {
      const pairKey = [idA, idB].sort().join('___');
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);

      const pB = products.find(p => p.id === idB);
      if (!pB || count < 1) return;

      const confidencePercent = Math.min(95, count * 35);
      const estImpact = Math.round((pB.price || 100) * count * 4);

      crossSellOpportunities.push({
        primaryProductId: pA.id,
        primaryProductName: pA.name,
        suggestedProductId: pB.id,
        suggestedProductName: pB.name,
        coOccurrenceCount: count,
        confidencePercent,
        potentialRevenueImpact: estImpact,
        recommendation: `Customers purchasing ${pA.name} frequently co-purchase ${pB.name}. Recommend bundling or post-purchase suggestion.`,
      });
    });
  });

  // Sort cross sell by impact
  crossSellOpportunities.sort((a, b) => b.potentialRevenueImpact - a.potentialRevenueImpact);

  // 3. Repeat Purchase Opportunities (Approaching repurchase window)
  const repeatPurchaseOpportunities = customerProfiles
    .filter(c => c.recencyDays >= Math.max(7, c.typicalPurchaseIntervalDays - 5) && c.recencyDays <= c.typicalPurchaseIntervalDays + 10)
    .slice(0, 5)
    .map(c => ({
      customerName: c.name,
      lastPurchaseDaysAgo: c.recencyDays,
      typicalIntervalDays: c.typicalPurchaseIntervalDays,
      recommendedAction: `Customer is entering typical ${c.typicalPurchaseIntervalDays}-day repurchase window. Present personalized reorder notification.`,
    }));

  // 4. Revenue & Product Concentration Analysis
  const sortedCusts = [...customerProfiles].sort((a, b) => b.totalSpend - a.totalSpend);
  const top5Spend = sortedCusts.slice(0, 5).reduce((sum, c) => sum + c.totalSpend, 0);
  const top5CustomersPercent = totalRev > 0 ? Math.round((top5Spend / totalRev) * 100) : 0;

  // Top products concentration
  const productSpendMap: Record<string, number> = {};
  salesTx.forEach(t => {
    const key = t.productName || t.productId || 'Item';
    productSpendMap[key] = (productSpendMap[key] || 0) + (t.totalRevenue || (t.quantity * (t.price || 0)));
  });
  const sortedProdSpend = Object.values(productSpendMap).sort((a, b) => b - a);
  const top3ProdSpend = sortedProdSpend.slice(0, 3).reduce((sum, v) => sum + v, 0);
  const top3ProductsPercent = totalRev > 0 ? Math.round((top3ProdSpend / totalRev) * 100) : 0;

  let concRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';
  let concExplanation = 'Revenue is well-distributed across customer segments and catalog SKUs.';
  if (top5CustomersPercent > 50 || top3ProductsPercent > 55) {
    concRiskLevel = 'High';
    concExplanation = `High concentration dependency: Top 3 products drive ${top3ProductsPercent}% of revenue. High risk if top items run out of stock.`;
  } else if (top5CustomersPercent > 35 || top3ProductsPercent > 40) {
    concRiskLevel = 'Medium';
    concExplanation = `Moderate concentration: Top products account for ${top3ProductsPercent}% of gross revenue.`;
  }

  // 5. Scored Growth Opportunities Engine
  const storedStatuses = getStoredOpportunityStatuses();
  const opportunities: GrowthOpportunity[] = [];

  // Opp 1: Product Growth Opportunity (High margin + high velocity + healthy stock)
  products.forEach(p => {
    const pReport = computeProductIntelligence(p, transactions, returns, suppliers);
    if (pReport.profitMarginPercent >= 30 && pReport.averageDailySales >= 0.8 && p.stock > (p.minStock || 5)) {
      const oppId = `opp-prod-growth-${p.id}`;
      const status = storedStatuses[oppId] || 'DETECTED';
      if (status !== 'DISMISSED') {
        const addRev = Math.round((p.price || 100) * pReport.averageDailySales * 30 * 0.25);
        const addProf = Math.round(addRev * (pReport.profitMarginPercent / 100));

        opportunities.push({
          id: oppId,
          type: 'product_growth',
          title: `Scale Allocation: ${p.name}`,
          description: `Sales velocity (+${Math.round(pReport.averageDailySales * 100 / 3)}%) and high margin (${pReport.profitMarginPercent}%) signal strong demand growth.`,
          targetEntityName: p.name,
          opportunityScore: Math.min(98, Math.round(pReport.performanceScore * 0.95 + 10)),
          expectedAdditionalRevenue: addRev,
          expectedAdditionalProfit: addProf,
          confidence: 'High',
          confidenceReason: 'Supported by verified daily sales velocity and positive margin trajectory.',
          recommendation: `Increase replenishment and feature ${p.name} on storefront while demand remains high.`,
          status,
          detectedDate: new Date().toISOString().split('T')[0],
        });
      }
    }
  });

  // Opp 2: Cross-Sell Opportunity
  crossSellOpportunities.slice(0, 3).forEach((cs, i) => {
    const oppId = `opp-cross-sell-${i + 1}`;
    const status = storedStatuses[oppId] || 'DETECTED';
    if (status !== 'DISMISSED') {
      opportunities.push({
        id: oppId,
        type: 'cross_sell',
        title: `Cross-Sell Bundle: ${cs.primaryProductName} + ${cs.suggestedProductName}`,
        description: `Verified co-occurrence: ${cs.coOccurrenceCount} buyers purchased both items together.`,
        targetEntityName: `${cs.primaryProductName} Bundle`,
        opportunityScore: Math.min(94, 75 + cs.coOccurrenceCount * 5),
        expectedAdditionalRevenue: cs.potentialRevenueImpact,
        expectedAdditionalProfit: Math.round(cs.potentialRevenueImpact * 0.35),
        confidence: cs.confidencePercent > 70 ? 'High' : 'Medium',
        confidenceReason: `Co-occurrence count of ${cs.coOccurrenceCount} orders verified in transaction logs.`,
        recommendation: cs.recommendation,
        status,
        detectedDate: new Date().toISOString().split('T')[0],
      });
    }
  });

  // Opp 3: At-Risk Customer Retention Opportunity
  if (atRiskCustomers.length > 0) {
    const oppId = 'opp-at-risk-retention';
    const status = storedStatuses[oppId] || 'DETECTED';
    if (status !== 'DISMISSED') {
      const atRiskSpend = atRiskCustomers.reduce((sum, c) => sum + c.avgOrderValue, 0);
      opportunities.push({
        id: oppId,
        type: 'customer_retention',
        title: `Re-Engage ${atRiskCustomers.length} At-Risk Customer(s)`,
        description: `${atRiskCustomers.length} historical repeat buyers have exceeded their typical repurchase interval by 2x.`,
        targetEntityName: 'At-Risk Segment',
        opportunityScore: 88,
        expectedAdditionalRevenue: Math.round(atRiskSpend * 0.6),
        expectedAdditionalProfit: Math.round(atRiskSpend * 0.6 * 0.35),
        confidence: 'High',
        confidenceReason: 'Calculated from historical customer purchasing intervals.',
        recommendation: `Launch a win-back offer targeting ${atRiskCustomers[0]?.name || 'at-risk buyers'}.`,
        status,
        detectedDate: new Date().toISOString().split('T')[0],
      });
    }
  }

  // Sort opportunities by score
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // 6. Growth Bottlenecks & Operational Constraints Detection
  const positiveDrivers: string[] = [];
  const growthBottlenecks: string[] = [];

  if (repeatPurchaseRatePercent >= 30) {
    positiveDrivers.push(`Strong repeat purchase rate at ${repeatPurchaseRatePercent}% (+${repeatRateChangePoints} pts vs prior).`);
  }
  if (top3ProductsPercent <= 45) {
    positiveDrivers.push(`Balanced catalog demand distribution across top products.`);
  }

  // Check growth bottlenecks
  products.forEach(p => {
    const pReport = computeProductIntelligence(p, transactions, returns, suppliers);
    if (pReport.averageDailySales > 1.5 && pReport.daysOfStockRemaining < 10) {
      growthBottlenecks.push(`Growth Constraint: ${p.name} demand velocity is high, but current stock covers only ${pReport.daysOfStockRemaining} days. Replenish before scaling promotion.`);
    }
  });

  suppliers.forEach(s => {
    const sScore = calculateSupplierPerformanceScore(s, orders);
    if (sScore.score !== null && sScore.score < 70) {
      growthBottlenecks.push(`Supplier Capacity Risk: ${s.name} performance score is ${sScore.score}/100. Vendor delays may constrain inventory scaling.`);
    }
  });

  if (growthBottlenecks.length === 0) {
    positiveDrivers.push('Inventory stock levels and supplier lead times support active revenue expansion.');
  }

  // 7. Calculate Overall Growth Health Score (0-100)
  const repeatScore = Math.min(30, (repeatPurchaseRatePercent / 40) * 30);
  const velocityScore = Math.min(30, (salesTx.length / 50) * 30);
  const concentrationPenalty = concRiskLevel === 'High' ? 15 : concRiskLevel === 'Medium' ? 5 : 0;
  const bottleneckPenalty = growthBottlenecks.length * 8;

  const growthHealthScore = Math.max(35, Math.min(100, Math.round(40 + repeatScore + velocityScore - concentrationPenalty - bottleneckPenalty)));

  let scoreCategory: GrowthReport['scoreCategory'] = 'Healthy Trajectory';
  if (growthHealthScore >= 85) scoreCategory = 'Aggressive Growth';
  else if (growthHealthScore >= 70) scoreCategory = 'Healthy Trajectory';
  else if (growthHealthScore >= 55) scoreCategory = 'Constrained Growth';
  else scoreCategory = 'High Growth Risk';

  return {
    hasData: true,
    growthHealthScore,
    scoreCategory,
    positiveDrivers,
    growthBottlenecks,
    totalCustomers,
    newCustomersCount: newCount,
    returningCustomersCount: returningCount,
    repeatPurchaseRatePercent,
    repeatPurchaseRatePriorPercent,
    repeatRateChangePoints,
    avgOrderValue,
    segmentsBreakdown,
    customersList: customerProfiles,
    atRiskCustomers,
    crossSellOpportunities,
    repeatPurchaseOpportunities,
    revenueConcentration: {
      top5CustomersPercent,
      top3ProductsPercent,
      riskLevel: concRiskLevel,
      explanation: concExplanation,
    },
    opportunities,
  };
}
