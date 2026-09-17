import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import { serializePlainData } from './utils';
import type { Product, Transaction, Supplier, ProductReturn, PurchaseOrder } from './types';
import { calculateDynamicBrief, type AIBriefOutput } from '@/ai/flows/ai-brief-generator';

export interface AnalyticsSummary {
  totalProducts: number;
  totalTransactions: number;
  totalOrders: number;
  totalSuppliers: number;
  totalCategories: number;
  totalReturns: number;
  inventoryValuation: number;
  totalCostValue: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMarginPercent: number;
  recognizedRevenue: number;
  pendingOrderValue: number;
  pendingOrderCount: number;
  paymentReceived: number;
  pendingPaymentValue: number;
  realizedProfit: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  deadStockCount: number;
  deadStockValuation: number;
  totalUnitsSold: number;
  healthScore: number;
  lastUpdated: string;
}

export const DEFAULT_ANALYTICS_SUMMARY: AnalyticsSummary = {
  totalProducts: 0,
  totalTransactions: 0,
  totalOrders: 0,
  totalSuppliers: 0,
  totalCategories: 0,
  totalReturns: 0,
  inventoryValuation: 0,
  totalCostValue: 0,
  totalRevenue: 0,
  totalCost: 0,
  grossProfit: 0,
  profitMarginPercent: 35,
  recognizedRevenue: 0,
  pendingOrderValue: 0,
  pendingOrderCount: 0,
  paymentReceived: 0,
  pendingPaymentValue: 0,
  realizedProfit: 0,
  lowStockCount: 0,
  criticalStockCount: 0,
  outOfStockCount: 0,
  deadStockCount: 0,
  deadStockValuation: 0,
  totalUnitsSold: 0,
  healthScore: 100,
  lastUpdated: new Date().toISOString(),
};

/**
 * Fetches the precalculated analytics summary document for a user
 */
export async function getAnalyticsSummary(
  firestore: Firestore,
  userId: string
): Promise<AnalyticsSummary | null> {
  try {
    const summaryRef = doc(firestore, 'users', userId, 'analytics', 'summary');
    const snap = await getDoc(summaryRef);
    if (!snap.exists()) return null;
    return serializePlainData<AnalyticsSummary>(snap.data());
  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    return null;
  }
}

/**
 * Recalculates and persists the analytics summary document and AI brief in Firestore.
 * Can be passed arrays directly (e.g. at the end of an import batch) or will fetch collections.
 */
export async function recalculateAndSaveAnalyticsSummary(
  firestore: Firestore,
  userId: string,
  providedData?: {
    products?: Product[];
    transactions?: Transaction[];
    suppliers?: Supplier[];
    orders?: PurchaseOrder[];
    returns?: ProductReturn[];
  }
): Promise<AnalyticsSummary> {
  let products = providedData?.products;
  let transactions = providedData?.transactions;
  let suppliers = providedData?.suppliers;
  let orders = providedData?.orders;
  let returns = providedData?.returns;

  // If not provided, fetch current collections safely
  if (!products) {
    const pSnap = await getDocs(collection(firestore, 'users', userId, 'products')).catch(() => ({ docs: [] }));
    products = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }
  if (!transactions) {
    const tSnap = await getDocs(collection(firestore, 'users', userId, 'transactions')).catch(() => ({ docs: [] }));
    transactions = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
  }
  if (!suppliers) {
    const sSnap = await getDocs(collection(firestore, 'users', userId, 'suppliers')).catch(() => ({ docs: [] }));
    suppliers = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
  }
  if (!orders) {
    const oSnap = await getDocs(collection(firestore, 'users', userId, 'orders')).catch(() => ({ docs: [] }));
    orders = oSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
  }
  if (!returns) {
    const rSnap = await getDocs(collection(firestore, 'users', userId, 'returns')).catch(() => ({ docs: [] }));
    returns = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductReturn));
  }

  // 1. Calculate Product & Valuation Metrics
  let inventoryValuation = 0;
  let totalCostValue = 0;
  let lowStockCount = 0;
  let criticalStockCount = 0;
  let outOfStockCount = 0;

  products.forEach(p => {
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    const costPrice = Number(p.costPrice) || Math.round(price * 0.6);
    const minStock = Number(p.minStock) || 5;

    inventoryValuation += stock * price;
    totalCostValue += stock * costPrice;

    if (stock === 0) {
      outOfStockCount++;
      criticalStockCount++;
    } else if (stock <= minStock) {
      lowStockCount++;
    }
  });

  // 2. Calculate Transaction & Revenue Metrics
  // Earned Revenue Recognition Model:
  // - Recognized Revenue & Realized Profit: Only recognized when fulfilled or delivered
  // - Pending Order Value: Placed orders not yet fulfilled/delivered
  // - Payment Received: Tracked separately where payment is confirmed (PAID)
  let recognizedRevenue = 0;
  let recognizedCost = 0;
  let totalUnitsSold = 0;
  let pendingOrderValue = 0;
  let pendingOrderCount = 0;
  let paymentReceived = 0;
  let pendingPaymentValue = 0;

  const soldProductIds = new Set<string>();
  const soldProductNames = new Set<string>();

  transactions.forEach((t: any) => {
    if (t.type === 'Sale' || t.type === 'sale') {
      const qty = Number(t.quantity ?? t.units_sold ?? t.qty ?? t.unitsSold ?? 1) || 1;
      const price = Number(t.price ?? t.selling_price ?? t.sellingPrice ?? 0);
      const rev = Number(t.totalRevenue ?? t.revenue ?? t.amount) || (price * qty);
      const costPerUnit = Number(t.costPerUnit ?? t.costPrice ?? t.cost_per_unit ?? t.cost_price) || Math.round(price * 0.6);
      const cost = Number(t.totalCost ?? t.total_cost) || (costPerUnit * qty);

      // Determine fulfillment / delivery status
      const rawFulfillment = String(t.fulfillmentStatus || t.status || '').toUpperCase();
      const isFulfilled =
        t.isRevenueRecognized === true ||
        rawFulfillment === 'FULFILLED' ||
        rawFulfillment === 'DELIVERED' ||
        rawFulfillment === 'SHIPPED' ||
        rawFulfillment === 'COMPLETED';

      // Determine payment status
      const rawFinancial = String(t.financialStatus || '').toUpperCase();
      const isExplicitlyUnpaid = rawFinancial === 'PENDING' || rawFinancial === 'UNPAID' || rawFinancial === 'AUTHORIZED' || t.paymentReceived === false;
      const isPaid = t.paymentReceived === true || rawFinancial === 'PAID' || rawFinancial === 'PARTIALLY_REFUNDED' || (!isExplicitlyUnpaid && isFulfilled);

      if (isFulfilled) {
        recognizedRevenue += rev;
        recognizedCost += cost;
        totalUnitsSold += qty;

        if (t.productId || t.product_id) soldProductIds.add(String(t.productId || t.product_id));
        if (t.productName || t.product_name || t.name) soldProductNames.add(String(t.productName || t.product_name || t.name).toLowerCase());
        if (t.sku) soldProductNames.add(String(t.sku).toLowerCase());
      } else {
        pendingOrderValue += rev;
        pendingOrderCount++;
      }

      if (isPaid) {
        paymentReceived += rev;
      } else {
        pendingPaymentValue += rev;
      }
    }
  });

  // Returns and refunds deduct from recognized revenue
  let totalRefunds = 0;
  returns.forEach((r: any) => {
    const refund = Number(r.refundAmount || r.refund_amount || r.totalRefund || 0);
    totalRefunds += refund;
  });

  const netRecognizedRevenue = Math.max(0, recognizedRevenue - totalRefunds);
  const realizedProfit = Math.max(0, netRecognizedRevenue - recognizedCost);
  const profitMarginPercent = netRecognizedRevenue > 0 ? Math.round((realizedProfit / netRecognizedRevenue) * 100) : 35;

  // 3. Dead Stock Calculation (in stock but no sales)
  let deadStockCount = 0;
  let deadStockValuation = 0;

  products.forEach(p => {
    const stock = Number(p.stock) || 0;
    if (stock > 0) {
      const isSold =
        soldProductIds.has(p.id) ||
        (p.name && soldProductNames.has(p.name.toLowerCase())) ||
        (p.sku && soldProductNames.has(p.sku.toLowerCase()));

      const isLiquidated = p.liquidationStatus === 'Liquidated' || Boolean(p.compareAtPrice && p.compareAtPrice > p.price);

      if (!isSold && !isLiquidated) {
        deadStockCount++;
        deadStockValuation += stock * (Number(p.costPrice) || (Number(p.price) * 0.6));
      }
    }
  });

  // 4. Calculate Health Score (0 - 100)
  let healthScore = 100;
  if (products.length > 0) {
    const outPercent = outOfStockCount / products.length;
    const lowPercent = lowStockCount / products.length;
    const deadPercent = deadStockCount / products.length;
    healthScore -= Math.round(outPercent * 40 + lowPercent * 20 + deadPercent * 20);
    healthScore = Math.max(10, Math.min(100, healthScore));
  }

  const summary: AnalyticsSummary = {
    totalProducts: products.length,
    totalTransactions: transactions.length,
    totalOrders: orders.length,
    totalSuppliers: suppliers.length,
    totalCategories: new Set(products.map(p => p.category || 'General')).size,
    totalReturns: returns.length,
    inventoryValuation: Math.round(inventoryValuation),
    totalCostValue: Math.round(totalCostValue),
    totalRevenue: Math.round(netRecognizedRevenue),
    totalCost: Math.round(recognizedCost),
    grossProfit: Math.round(realizedProfit),
    profitMarginPercent,
    recognizedRevenue: Math.round(netRecognizedRevenue),
    pendingOrderValue: Math.round(pendingOrderValue),
    pendingOrderCount,
    paymentReceived: Math.round(paymentReceived),
    pendingPaymentValue: Math.round(pendingPaymentValue),
    realizedProfit: Math.round(realizedProfit),
    lowStockCount,
    criticalStockCount,
    outOfStockCount,
    deadStockCount,
    deadStockValuation: Math.round(deadStockValuation),
    totalUnitsSold,
    healthScore,
    lastUpdated: new Date().toISOString(),
  };

  // Persist summary document with timeout protection
  const summaryRef = doc(firestore, 'users', userId, 'analytics', 'summary');
  await Promise.race([
    setDoc(summaryRef, serializePlainData(summary), { merge: true }),
    new Promise(resolve => setTimeout(resolve, 4000)),
  ]).catch(e => console.warn('Summary setDoc timeout notice:', e));

  // Pre-generate & Persist AI Brief asynchronously
  try {
    const brief = await calculateDynamicBrief(products, transactions);
    const briefRef = doc(firestore, 'users', userId, 'analytics', 'ai_brief');
    await Promise.race([
      setDoc(briefRef, serializePlainData({
        ...brief,
        updatedAt: new Date().toISOString(),
      }), { merge: true }),
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]).catch(e => console.warn('AI Brief setDoc timeout notice:', e));
  } catch (err) {
    console.warn('AI Brief generation during analytics aggregation:', err);
  }

  return summary;
}

/**
 * Fetches the saved AI Brief document for a user
 */
export async function getPersistedAIBrief(
  firestore: Firestore,
  userId: string
): Promise<AIBriefOutput | null> {
  try {
    const briefRef = doc(firestore, 'users', userId, 'analytics', 'ai_brief');
    const snap = await getDoc(briefRef);
    if (!snap.exists()) return null;
    return serializePlainData<AIBriefOutput>(snap.data());
  } catch (err) {
    console.error('Error fetching persisted AI brief:', err);
    return null;
  }
}
