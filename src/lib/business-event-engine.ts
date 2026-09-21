import {
  Product,
  Transaction,
  Supplier,
  PurchaseOrder,
  ProductReturn,
  BusinessProfile,
  BusinessEvent,
  EventSeverity,
  EventStatus,
  NotificationPreferences,
} from './types';
import { computeBusinessHealth } from './command-center-engine';
import { detectProcurementRisks } from './supplier-intelligence-engine';
import { generateBusinessForecastingReport } from './forecasting-engine';
import { computeCustomerGrowthIntelligence } from './customer-growth-engine';
import { formatCur } from './utils';

const getSlug = (str: string) => (str || 'item').toLowerCase().replace(/[^a-z0-9]/g, '-');

// 1. Detect All Business Events
export function detectBusinessEvents(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null,
  preferences?: NotificationPreferences
): BusinessEvent[] {
  const events: BusinessEvent[] = [];
  const nowIso = new Date().toISOString();

  // Helper to add event if category matches user preferences
  const addEvent = (event: BusinessEvent) => {
    if (preferences) {
      if (!preferences.categories[event.category]) return;
      if (preferences.minPriority === 'CRITICAL' && event.severity !== 'CRITICAL') return;
      if (preferences.minPriority === 'HIGH' && event.severity !== 'CRITICAL' && event.severity !== 'HIGH') return;
    }
    events.push(event);
  };

  // --- CATEGORY 1: INVENTORY & STOCKOUT EVENTS ---
  const forecastingReport = generateBusinessForecastingReport(products, transactions, suppliers, orders);

  const highRiskStockouts = forecastingReport.stockoutProjections.filter(s => s.stockoutRiskLevel === 'HIGH');
  if (highRiskStockouts.length > 3) {
    // Grouped Summary Alert
    const totalQty = highRiskStockouts.reduce((sum, s) => sum + s.recommendedReorderQty, 0);
    const affectedNames = highRiskStockouts.map(s => s.productName);

    addEvent({
      id: 'event-group-stockout-critical',
      type: 'STOCKOUT_RISK',
      category: 'inventory',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      impactScore: 92,
      entityId: 'grouped-inventory-stockout',
      entityName: `${highRiskStockouts.length} Catalog Products`,
      title: `${highRiskStockouts.length} Products at High Stockout Risk`,
      description: `${highRiskStockouts.length} products will deplete before supplier lead time. Reorder total of ${totalQty} units to prevent stockouts.`,
      impactFormatted: `High revenue risk across ${highRiskStockouts.length} SKUs`,
      recommendation: `Issue purchase orders for ${affectedNames.slice(0, 3).join(', ')}...`,
      firstDetected: nowIso,
      lastUpdated: nowIso,
      groupCount: highRiskStockouts.length,
      affectedItemNames: affectedNames,
      actionPayload: {
        actionType: 'navigate',
        targetRoute: '/dashboard/forecasting',
      },
    });
  } else {
    // Individual stockout alerts
    highRiskStockouts.forEach(stockout => {
      const isOut = stockout.currentStock <= 0;
      const severity: EventSeverity = isOut ? 'CRITICAL' : 'HIGH';
      const impactScore = isOut ? 95 : 82;

      addEvent({
        id: `event-stockout-${getSlug(stockout.productId)}`,
        type: 'STOCKOUT_RISK',
        category: 'inventory',
        severity,
        status: 'ACTIVE',
        impactScore,
        entityId: stockout.productId,
        entityName: stockout.productName,
        title: isOut ? `OUT OF STOCK: ${stockout.productName}` : `Stockout Alert: ${stockout.productName}`,
        description: isOut
          ? `${stockout.productName} is currently OUT OF STOCK. Supplier lead time is ${stockout.supplierLeadTimeDays} days.`
          : `Projected to run out of stock in ${stockout.daysRemaining} days (less than ${stockout.supplierLeadTimeDays}-day vendor lead time).`,
        impactFormatted: `Revenue loss risk if unfulfilled`,
        recommendation: `Issue PO for ${stockout.recommendedReorderQty} units with ${stockout.preferredSupplierName}.`,
        firstDetected: nowIso,
        lastUpdated: nowIso,
        actionPayload: {
          actionType: 'reorder',
          targetRoute: '/dashboard/inventory',
          targetId: stockout.productId,
          reorderQty: stockout.recommendedReorderQty,
        },
      });
    });
  }

  // --- CATEGORY 2: SUPPLIER COST & LEAD TIME EVENTS ---
  const procurementRisks = detectProcurementRisks(products, suppliers, orders, transactions);
  procurementRisks.forEach(risk => {
    const isCostInc = risk.type === 'cost_increase';
    const severity: EventSeverity = risk.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';

    addEvent({
      id: `event-supplier-${risk.id}`,
      type: isCostInc ? 'SUPPLIER_COST_INCREASE' : 'SUPPLIER_LEAD_TIME_SPIKE',
      category: 'suppliers',
      severity,
      status: 'ACTIVE',
      impactScore: isCostInc ? 78 : 65,
      entityId: getSlug(risk.supplierName),
      entityName: risk.supplierName,
      title: `${isCostInc ? 'Supplier Cost Increase' : 'Supplier Lead Time Risk'}: ${risk.supplierName}`,
      description: risk.problem,
      impactFormatted: risk.impact,
      recommendation: risk.recommendation,
      firstDetected: nowIso,
      lastUpdated: nowIso,
      actionPayload: {
        actionType: 'supplier',
        targetRoute: '/dashboard/suppliers',
        targetId: getSlug(risk.supplierName),
      },
    });
  });

  // --- CATEGORY 3: MARGIN EROSION & PROFIT EVENTS ---
  products.forEach(product => {
    const price = product.price || 0;
    const cost = product.costPrice || (price * 0.6);
    const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

    if (price > 0 && margin < 15) {
      const isLoss = margin < 0;
      addEvent({
        id: `event-margin-${getSlug(product.id)}`,
        type: 'MARGIN_EROSION',
        category: 'finance',
        severity: isLoss ? 'CRITICAL' : 'HIGH',
        impactScore: isLoss ? 90 : 75,
        status: 'ACTIVE',
        entityId: product.id,
        entityName: product.name || 'Product',
        title: isLoss ? `Loss-Making SKU: ${product.name}` : `Low Margin Alert: ${product.name}`,
        description: isLoss
          ? `${product.name} cost price (${formatCur(cost)}) exceeds retail price (${formatCur(price)}), creating a negative margin of ${Math.round(margin)}%.`
          : `${product.name} profit margin is currently ${Math.round(margin)}%, which is below the 15% minimum margin benchmark.`,
        impactFormatted: `Margin reduction of ${Math.round(15 - margin)} percentage points`,
        recommendation: isLoss
          ? `Increase retail price above ${formatCur(cost * 1.25)} or renegotiate vendor unit cost.`
          : `Review unit price or negotiate volume discount with supplier.`,
        firstDetected: nowIso,
        lastUpdated: nowIso,
        actionPayload: {
          actionType: 'price_up',
          targetRoute: '/dashboard/inventory',
          targetId: product.id,
        },
      });
    }
  });

  // --- CATEGORY 4: BUSINESS HEALTH SCORE CHANGE ---
  const health = computeBusinessHealth(products, transactions, suppliers, returns);
  if (health.score < 75) {
    addEvent({
      id: 'event-health-score-low',
      type: 'HEALTH_SCORE_CHANGE',
      category: 'finance',
      severity: health.score < 60 ? 'CRITICAL' : 'HIGH',
      impactScore: 85,
      status: 'ACTIVE',
      entityId: 'business-health-summary',
      entityName: 'Business Health Score',
      title: `Business Health Score Needs Attention: ${health.score}/100`,
      description: health.summarySentence,
      impactFormatted: `Health Quotient: ${health.category}`,
      recommendation: `Address inventory stockout risks and dead-stock lockups to elevate overall business score.`,
      firstDetected: nowIso,
      lastUpdated: nowIso,
      actionPayload: {
        actionType: 'navigate',
        targetRoute: '/dashboard/insights',
      },
    });
  }

  // --- CATEGORY 5: RETURN RATE ANOMALIES ---
  const salesTx = transactions.filter(t => t.type === 'Sale');
  if (returns.length > 0 && salesTx.length > 0) {
    const totalReturnQty = returns.reduce((sum, r) => sum + (r.quantity || 1), 0);
    const totalSalesQty = salesTx.reduce((sum, t) => sum + (t.quantity || 1), 0);
    const returnRatePercent = Math.round((totalReturnQty / totalSalesQty) * 100);

    if (returnRatePercent >= 8) {
      addEvent({
        id: 'event-return-rate-high',
        type: 'RETURN_RATE_SURGE',
        category: 'returns',
        severity: 'HIGH',
        impactScore: 72,
        status: 'ACTIVE',
        entityId: 'return-rate-metric',
        entityName: 'Catalog Returns',
        title: `High Return Rate Alert: ${returnRatePercent}%`,
        description: `Customer return rate (${returnRatePercent}%) exceeds the 5% industry threshold. ${returns.length} returns logged.`,
        impactFormatted: `High refund volume`,
        recommendation: `Audit product quality logs for defective items or packaging issues.`,
        firstDetected: nowIso,
        lastUpdated: nowIso,
        actionPayload: {
          actionType: 'navigate',
          targetRoute: '/dashboard/returns',
        },
      });
    }
  }

  // --- CATEGORY 6: CUSTOMER & GROWTH INTELLIGENCE ALERTS ---
  const growthReport = computeCustomerGrowthIntelligence(products, transactions, suppliers, orders, returns, businessProfile);

  if (growthReport.atRiskCustomers.length >= 2) {
    addEvent({
      id: 'event-at-risk-customers',
      type: 'AT_RISK_CUSTOMERS',
      category: 'finance',
      severity: 'HIGH',
      impactScore: 78,
      status: 'ACTIVE',
      entityId: 'at-risk-segment',
      entityName: 'At-Risk Customer Segment',
      title: `${growthReport.atRiskCustomers.length} At-Risk Repeat Customers`,
      description: `${growthReport.atRiskCustomers.length} historical repeat customers have exceeded their typical repurchase interval by 2x.`,
      impactFormatted: `Revenue churn risk`,
      recommendation: `Launch a win-back campaign targeting at-risk customer segment.`,
      firstDetected: nowIso,
      lastUpdated: nowIso,
      actionPayload: {
        actionType: 'navigate',
        targetRoute: '/dashboard/executive',
      },
    });
  }

  if (growthReport.revenueConcentration.riskLevel === 'High') {
    addEvent({
      id: 'event-revenue-concentration',
      type: 'REVENUE_CONCENTRATION_RISK',
      category: 'finance',
      severity: 'HIGH',
      impactScore: 82,
      status: 'ACTIVE',
      entityId: 'concentration-risk',
      entityName: 'Revenue Dependency',
      title: `High Revenue Concentration Risk`,
      description: growthReport.revenueConcentration.explanation,
      impactFormatted: `Dependency risk`,
      recommendation: `Expand product offering and diversify catalog demand to reduce top SKU dependency.`,
      firstDetected: nowIso,
      lastUpdated: nowIso,
      actionPayload: {
        actionType: 'navigate',
        targetRoute: '/dashboard/executive',
      },
    });
  }

  // Deduplicate and return events sorted by impact score
  return deduplicateEvents(events);
}

// 2. Deduplicate repeated events
function deduplicateEvents(events: BusinessEvent[]): BusinessEvent[] {
  const map = new Map<string, BusinessEvent>();

  for (const event of events) {
    const key = `${event.type}-${event.entityId}`;
    if (!map.has(key)) {
      map.set(key, event);
    } else {
      const existing = map.get(key)!;
      if (event.impactScore > existing.impactScore) {
        map.set(key, event);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.impactScore - a.impactScore);
}

// 3. Generate Upgraded AI Morning Brief
export interface AIMorningBrief {
  dateFormatted: string;
  businessHealthScore: number;
  healthCategory: string;
  whatChangedToday: string[];
  whyItMatters: string;
  top3Priorities: { title: string; actionLabel: string; route?: string }[];
}

export function generateAIMorningBrief(
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  returns: ProductReturn[] = [],
  businessProfile?: BusinessProfile | null
): AIMorningBrief {
  const health = computeBusinessHealth(products, transactions, suppliers, returns);
  const events = detectBusinessEvents(products, transactions, suppliers, orders, returns, businessProfile);

  const dateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const whatChangedToday: string[] = [];

  const criticalEvents = events.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH');
  criticalEvents.slice(0, 4).forEach(e => {
    whatChangedToday.push(`${e.title}: ${e.impactFormatted}`);
  });

  if (whatChangedToday.length === 0) {
    whatChangedToday.push('Operations are running smoothly with stable inventory velocity.');
  }

  const top3Priorities = events.slice(0, 3).map(e => ({
    title: e.title,
    actionLabel: e.recommendation,
    route: e.actionPayload?.targetRoute,
  }));

  return {
    dateFormatted,
    businessHealthScore: health.score,
    healthCategory: health.category,
    whatChangedToday,
    whyItMatters: health.summarySentence,
    top3Priorities,
  };
}

let currentEventUserId: string | null = null;

export function setActiveEventUserId(userId: string | null) {
  currentEventUserId = userId;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('analyzeup_event_statuses_v1');
      localStorage.removeItem('analyzeup_event_statuses');
    } catch {}
  }
}

export function getStoredEventStatuses(userId?: string): Record<string, EventStatus> {
  const uid = userId || currentEventUserId;
  if (!uid) return {};
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`analyzeup_event_statuses_${uid}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveEventStatus(eventId: string, status: EventStatus, userId?: string) {
  const uid = userId || currentEventUserId;
  if (!uid) return;
  try {
    const current = getStoredEventStatuses(uid);
    current[eventId] = status;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`analyzeup_event_statuses_${uid}`, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('analyzeup_events_updated', { detail: { userId: uid } }));
    }
  } catch (err) {
    console.error('Failed to save event status:', err);
  }
}

export function clearAllEventStatuses(eventIds: string[], userId?: string) {
  const uid = userId || currentEventUserId;
  if (!uid) return;
  try {
    const current = getStoredEventStatuses(uid);
    eventIds.forEach(id => {
      current[id] = 'RESOLVED';
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`analyzeup_event_statuses_${uid}`, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('analyzeup_events_updated', { detail: { userId: uid } }));
    }
  } catch (err) {
    console.error('Failed to clear event statuses:', err);
  }
}
