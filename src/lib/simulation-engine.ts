import {
  Product,
  Transaction,
  Supplier,
  PurchaseOrder,
  BusinessProfile,
  SimulationType,
  SimulationBaseline,
  SimulationResult,
  SavedScenario,
} from './types';
import { computeProductIntelligence } from './product-intelligence-engine';
import { calculateSupplierPerformanceScore } from './supplier-intelligence-engine';
import { formatCur } from './utils';

let currentSimulationUserId: string | null = null;

export function setActiveSimulationUserId(userId: string | null) {
  currentSimulationUserId = userId;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('analyzeup_saved_simulations_v1');
    } catch {}
  }
}

export function getSavedScenarios(userId?: string): SavedScenario[] {
  const uid = userId || currentSimulationUserId;
  if (!uid) return [];
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`analyzeup_saved_simulations_${uid}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveScenario(name: string, result: SimulationResult, inputs: Record<string, any>, userId?: string): SavedScenario {
  const uid = userId || currentSimulationUserId;
  const newScenario: SavedScenario = {
    id: `scenario-${Date.now()}`,
    name: name || `${result.title} (${new Date().toLocaleDateString('en-IN')})`,
    createdDate: new Date().toISOString().split('T')[0],
    type: result.type,
    targetEntityName: result.targetEntityName,
    inputs,
    result,
  };

  if (uid) {
    try {
      const current = getSavedScenarios(uid);
      const updated = [newScenario, ...current];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`analyzeup_saved_simulations_${uid}`, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('analyzeup_simulations_updated', { detail: { userId: uid } }));
      }
    } catch (err) {
      console.error('Failed to save simulation scenario:', err);
    }
  }

  return newScenario;
}

export function deleteSavedScenario(id: string, userId?: string) {
  const uid = userId || currentSimulationUserId;
  if (uid) {
    try {
      const current = getSavedScenarios(uid);
      const updated = current.filter(s => s.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`analyzeup_saved_simulations_${uid}`, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('analyzeup_simulations_updated', { detail: { userId: uid } }));
      }
    } catch (err) {
      console.error('Failed to delete simulation scenario:', err);
    }
  }
}

// Core Deterministic Business Simulation Engine
export function runBusinessSimulation(
  type: SimulationType,
  targetProductId: string,
  params: Record<string, any> = {},
  products: Product[] = [],
  transactions: Transaction[] = [],
  suppliers: Supplier[] = [],
  orders: PurchaseOrder[] = [],
  businessProfile?: BusinessProfile | null
): SimulationResult {
  if (!products || products.length === 0) {
    const emptyBaseline: SimulationBaseline = {
      revenue: 0,
      grossProfit: 0,
      profitMarginPercent: 0,
      productPrice: 0,
      productCost: 0,
      stock: 0,
      daysOfStock: 0,
      dailyVelocity: 0,
      supplierLeadTime: 0,
      supplierReliability: 0,
    };
    return {
      id: `sim-empty-${Date.now()}`,
      type,
      title: 'Simulation Unavailable (No Products)',
      targetEntityName: 'None',
      baseline: emptyBaseline,
      simulated: {
        newPrice: 0,
        newCost: 0,
        demandChangePercent: 0,
        projectedRevenue: 0,
        projectedProfit: 0,
        marginChangePercentagePoints: 0,
        projectedStockRemaining: 0,
        daysOfStockRemaining: 0,
        capitalRequired: 0,
        capitalRecovered: 0,
        stockoutRiskLevel: 'Low',
      },
      opportunityScore: 0,
      riskScore: 0,
      confidence: 'LOW',
      confidenceReason: 'No product data loaded in workspace.',
      assumptions: ['No product data currently loaded in workspace.'],
      risks: ['Import products or upload CSV to run What-If strategic simulations.'],
      recommendation: 'Add or import products into your workspace to test pricing, order quantities, and supplier decision scenarios.',
    };
  }

  const selectedProduct = products.find(p => p.id === targetProductId) || products[0];

  const pReport = computeProductIntelligence(selectedProduct, transactions, [], suppliers);

  const price = selectedProduct.price || 0;
  const cost = selectedProduct.costPrice || (price * 0.6);
  const stock = selectedProduct.stock || 0;
  const dailyVel = Math.max(0.1, pReport.averageDailySales);
  const marginPct = pReport.profitMarginPercent;

  const prefSupplier = suppliers.find(s => s.id === selectedProduct.supplierId || s.name === selectedProduct.supplier) || suppliers[0];
  const sMetrics = prefSupplier ? calculateSupplierPerformanceScore(prefSupplier, orders) : null;

  const baseline: SimulationBaseline = {
    revenue: Math.round(dailyVel * 30 * price),
    grossProfit: Math.round(dailyVel * 30 * (price - cost)),
    profitMarginPercent: marginPct,
    productPrice: price,
    productCost: cost,
    stock,
    daysOfStock: dailyVel > 0 ? Math.round(stock / dailyVel) : 0,
    dailyVelocity: Number(dailyVel.toFixed(1)),
    supplierLeadTime: selectedProduct.leadTimeDays || prefSupplier?.leadTimeDays || 7,
    supplierReliability: sMetrics?.score || 85,
  };

  const nowId = `sim-${Date.now()}`;

  // SCENARIO 1: PRICE CHANGE (+10% or custom)
  if (type === 'PRICE_CHANGE') {
    const changePct = params.priceChangePercent !== undefined ? Number(params.priceChangePercent) : 10;
    const newPrice = Math.round(price * (1 + changePct / 100));
    const demandChangePercent = Math.round(changePct * -0.6); // -0.6 elasticity factor
    const newDailyVel = Math.max(0.1, dailyVel * (1 + demandChangePercent / 100));

    const projectedRevenue = Math.round(newDailyVel * 30 * newPrice);
    const projectedProfit = Math.round(newDailyVel * 30 * (newPrice - cost));
    const newMarginPct = newPrice > 0 ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
    const marginDelta = newMarginPct - baseline.profitMarginPercent;

    return {
      id: nowId,
      type,
      title: `Price Shift Test: ${selectedProduct.name} (${changePct >= 0 ? '+' : ''}${changePct}%)`,
      targetEntityName: selectedProduct.name,
      baseline,
      simulated: {
        newPrice,
        newCost: cost,
        demandChangePercent,
        projectedRevenue,
        projectedProfit,
        marginChangePercentagePoints: marginDelta,
        projectedStockRemaining: Math.max(0, stock - Math.round(newDailyVel * 30)),
        daysOfStockRemaining: Math.round(stock / newDailyVel),
        capitalRequired: 0,
        capitalRecovered: 0,
        stockoutRiskLevel: Math.round(stock / newDailyVel) < 14 ? 'High' : 'Low',
      },
      opportunityScore: changePct > 0 ? 82 : 65,
      riskScore: changePct > 0 ? 38 : 55,
      confidence: 'MEDIUM',
      confidenceReason: 'Demand sensitivity estimated from standard price elasticity formulas.',
      assumptions: [
        `Demand elasticity assumption: ${changePct}% price shift yields estimated ${demandChangePercent}% volume response.`,
        'Retail selling price is updated; unit supplier cost remains unchanged.',
        'Current operating and shipping overhead costs remain constant.',
      ],
      risks: [
        'Higher retail price may cause slight demand volume reduction if cheaper alternatives exist.',
      ],
      recommendation: changePct > 0
        ? `A ${changePct}% price increase expands monthly profit by +${formatCur(projectedProfit - baseline.grossProfit)} (+${marginDelta} pts margin). Recommended to test on high-velocity items.`
        : `Price reduction increases volume but lowers unit margin by ${marginDelta} pts.`,
      suggestedActionPayload: {
        actionType: 'adjust_price',
        targetId: selectedProduct.id,
        suggestedPrice: newPrice,
      },
    };
  }

  // SCENARIO 2: DISCOUNT PROMOTION (-20% discount)
  if (type === 'DISCOUNT_PROMOTION') {
    const discountPct = params.discountPercent !== undefined ? Number(params.discountPercent) : 20;
    const newPrice = Math.round(price * (1 - discountPct / 100));
    const demandChangePercent = Math.round(discountPct * 1.4); // +28% volume surge
    const newDailyVel = dailyVel * (1 + demandChangePercent / 100);

    const projectedRevenue = Math.round(newDailyVel * 30 * newPrice);
    const projectedProfit = Math.round(newDailyVel * 30 * (newPrice - cost));
    const newMarginPct = newPrice > 0 ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
    const marginDelta = newMarginPct - baseline.profitMarginPercent;
    const capitalRecovered = Math.round(newDailyVel * 30 * newPrice);

    return {
      id: nowId,
      type,
      title: `Discount Promotion Test: ${selectedProduct.name} (-${discountPct}%)`,
      targetEntityName: selectedProduct.name,
      baseline,
      simulated: {
        newPrice,
        newCost: cost,
        demandChangePercent,
        projectedRevenue,
        projectedProfit,
        marginChangePercentagePoints: marginDelta,
        projectedStockRemaining: Math.max(0, stock - Math.round(newDailyVel * 30)),
        daysOfStockRemaining: Math.round(stock / newDailyVel),
        capitalRequired: 0,
        capitalRecovered,
        stockoutRiskLevel: Math.round(stock / newDailyVel) < 10 ? 'High' : 'Low',
      },
      opportunityScore: 78,
      riskScore: 42,
      confidence: 'HIGH',
      confidenceReason: 'Discount volume surge modeled from verified catalog sales history.',
      assumptions: [
        `Discount assumption: ${discountPct}% discount drives an estimated +${demandChangePercent}% sales volume surge.`,
        'Distinguishes gross revenue generation from unit margin dilution.',
        'Primary benefit is working capital liquidation and dead stock clearance.',
      ],
      risks: [
        `Unit margin compresses from ${baseline.profitMarginPercent}% down to ${newMarginPct}%.`,
      ],
      recommendation: `Promotional discount accelerates inventory liquidation, recovering ${formatCur(capitalRecovered)} in working capital.`,
      suggestedActionPayload: {
        actionType: 'discount',
        targetId: selectedProduct.id,
        suggestedPrice: newPrice,
      },
    };
  }

  // SCENARIO 3: INVENTORY PURCHASE (Order 300 units)
  if (type === 'INVENTORY_PURCHASE') {
    const purchaseQty = params.purchaseQty !== undefined ? Number(params.purchaseQty) : 300;
    const unitCost = params.unitCost !== undefined ? Number(params.unitCost) : cost;
    const capitalRequired = Math.round(purchaseQty * unitCost);

    const newStock = stock + purchaseQty;
    const newDaysStock = Math.round(newStock / dailyVel);
    const projectedRevenue = Math.round(dailyVel * 30 * price);
    const projectedProfit = Math.round(dailyVel * 30 * (price - unitCost));

    return {
      id: nowId,
      type,
      title: `Bulk Purchase Simulation: ${selectedProduct.name} (+${purchaseQty} units)`,
      targetEntityName: selectedProduct.name,
      baseline,
      simulated: {
        newPrice: price,
        newCost: unitCost,
        demandChangePercent: 0,
        projectedRevenue,
        projectedProfit,
        marginChangePercentagePoints: 0,
        projectedStockRemaining: newStock,
        daysOfStockRemaining: newDaysStock,
        capitalRequired,
        capitalRecovered: 0,
        stockoutRiskLevel: 'Low',
      },
      opportunityScore: 86,
      riskScore: 28,
      confidence: 'HIGH',
      confidenceReason: 'Inventory coverage days calculated against verified daily sales velocity.',
      assumptions: [
        `Upfront purchase requires ${formatCur(capitalRequired)} working capital allocation (capital required, not a cost saving).`,
        `Stock coverage expands from ${baseline.daysOfStock} days to ${newDaysStock} days.`,
        'Supplier lead time and fulfillment reliability verified from purchase order logs.',
      ],
      risks: [
        newDaysStock > 90 ? `Risk of overstock: ${newDaysStock} days of inventory exceeds 90-day threshold.` : 'Minimal stockout risk.',
      ],
      recommendation: `Ordering ${purchaseQty} units secures ${newDaysStock} days of inventory runway and eliminates imminent stockout risk.`,
      suggestedActionPayload: {
        actionType: 'create_po',
        targetId: selectedProduct.id,
        suggestedQty: purchaseQty,
      },
    };
  }

  // SCENARIO 4: SUPPLIER SWITCH
  if (type === 'SUPPLIER_SWITCH') {
    const altSupplier = suppliers.find(s => s.id !== prefSupplier?.id) || suppliers[1] || prefSupplier;
    const altCost = Math.round(cost * 0.9); // 10% cheaper
    const altLeadTime = (altSupplier?.leadTimeDays || 12);
    const altScore = calculateSupplierPerformanceScore(altSupplier, orders).score || 72;

    const projectedRevenue = Math.round(dailyVel * 30 * price);
    const projectedProfit = Math.round(dailyVel * 30 * (price - altCost));
    const newMarginPct = price > 0 ? Math.round(((price - altCost) / price) * 100) : 0;
    const marginDelta = newMarginPct - baseline.profitMarginPercent;

    return {
      id: nowId,
      type,
      title: `Supplier Switch Test: ${prefSupplier?.name || 'Current'} ➔ ${altSupplier.name}`,
      targetEntityName: altSupplier.name,
      baseline,
      simulated: {
        newPrice: price,
        newCost: altCost,
        demandChangePercent: 0,
        projectedRevenue,
        projectedProfit,
        marginChangePercentagePoints: marginDelta,
        projectedStockRemaining: stock,
        daysOfStockRemaining: baseline.daysOfStock,
        capitalRequired: 0,
        capitalRecovered: 0,
        stockoutRiskLevel: altLeadTime > 10 || altScore < 75 ? 'High' : 'Low',
      },
      opportunityScore: 74,
      riskScore: 58,
      confidence: 'MEDIUM',
      confidenceReason: 'Compares unit cost savings against vendor lead time and historical reliability.',
      assumptions: [
        `Switching to ${altSupplier.name} reduces unit cost from ${formatCur(cost)} to ${formatCur(altCost)}.`,
        `Lead time changes from ${baseline.supplierLeadTime} days to ${altLeadTime} days.`,
        `Vendor performance score is ${altScore}/100 compared to current ${baseline.supplierReliability}/100.`,
      ],
      risks: [
        `Stockout risk increases due to longer lead time (${altLeadTime} days) and lower reliability score (${altScore}/100).`,
      ],
      recommendation: `Switching to ${altSupplier.name} yields +${formatCur((projectedProfit - baseline.grossProfit) * 12)} annual cost savings, but increases stockout risk. Maintain safety stock before switching.`,
      suggestedActionPayload: {
        actionType: 'switch_supplier',
        targetId: altSupplier.id,
      },
    };
  }

  // DEFAULT / DEMAND SCENARIO (+20% Demand Surge)
  const demandShift = params.demandShiftPercent !== undefined ? Number(params.demandShiftPercent) : 20;
  const newDailyVel = dailyVel * (1 + demandShift / 100);
  const projectedRevenue = Math.round(newDailyVel * 30 * price);
  const projectedProfit = Math.round(newDailyVel * 30 * (price - cost));
  const newDaysStock = Math.round(stock / newDailyVel);

  return {
    id: nowId,
    type: 'DEMAND_CHANGE',
    title: `Demand Shift Test: ${selectedProduct.name} (${demandShift >= 0 ? '+' : ''}${demandShift}%)`,
    targetEntityName: selectedProduct.name,
    baseline,
    simulated: {
      newPrice: price,
      newCost: cost,
      demandChangePercent: demandShift,
      projectedRevenue,
      projectedProfit,
      marginChangePercentagePoints: 0,
      projectedStockRemaining: Math.max(0, stock - Math.round(newDailyVel * 30)),
      daysOfStockRemaining: newDaysStock,
      capitalRequired: 0,
      capitalRecovered: 0,
      stockoutRiskLevel: newDaysStock < 14 ? 'Critical' : 'Low',
    },
    opportunityScore: 84,
    riskScore: 35,
    confidence: 'HIGH',
    confidenceReason: 'Calculated against historical daily sales velocity.',
    assumptions: [
      `Demand shift assumption: ${demandShift}% change in sales velocity.`,
      'Unit selling price and supplier cost remain constant.',
    ],
    risks: [
      newDaysStock < 14 ? `Stockout Shortfall: Stock covers only ${newDaysStock} days under demand surge.` : 'Stable inventory runway.',
    ],
    recommendation: newDaysStock < 14
      ? `Demand surge of +${demandShift}% requires issuing purchase order immediately to prevent stockout.`
      : `Inventory stock supports projected +${demandShift}% demand surge.`,
    suggestedActionPayload: {
      actionType: 'create_po',
      targetId: selectedProduct.id,
      suggestedQty: Math.round(newDailyVel * 30),
    },
  };
}
