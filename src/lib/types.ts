import { FieldValue } from 'firebase/firestore';

export type BusinessType =
  | 'Retail'
  | 'Ecommerce'
  | 'Wholesale'
  | 'Manufacturing'
  | 'D2C'
  | 'General Business'
  | 'Restaurant'
  | 'Cafe'
  | 'Electronics'
  | 'Fashion'
  | 'Beauty'
  | 'Medical'
  | 'Hardware'
  | 'Automotive'
  | 'Sports'
  | 'Books'
  | 'Furniture'
  | 'Other';

export type BusinessSize = '1 Employee' | '2-10 Employees' | '11-50 Employees' | '50+ Employees' | 'Solo' | '50+';

export interface Product {
  id: string;
  name: string;
  category?: string;
  price: number;
  costPrice?: number;
  stock: number;
  minStock?: number;
  maxStock?: number;
  sku?: string;
  supplier?: string;
  supplierId?: string;
  leadTimeDays?: number;
  salesVelocity?: number;
  averageDailySales?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  profitMarginPercent?: number;
  riskLevel?: 'High' | 'Medium' | 'Low';
  userId?: string;
  tenantId?: string;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  productName?: string;
  title?: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  status?: string;
  source?: 'CSV' | 'SHOPIFY' | 'GDRIVE' | 'MANUAL' | string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  compareAtPrice?: number;
  discountPercent?: number;
  liquidationStatus?: string;
  customAttributes?: Record<string, string>;
}

export interface Order {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  quantity: number;
  price?: number;
  costPrice?: number;
  totalPrice?: number;
  date?: string;
  createdAt?: string | FieldValue;
}

export interface Transaction {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  category?: string;
  type: 'Sale' | 'Purchase' | 'Return' | 'Adjustment';
  quantity: number;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  costPerUnit?: number;
  totalRevenue?: number;
  totalCost?: number;
  supplier?: string;
  locationId?: string;
  transactionDate: string | FieldValue;
  transactionId?: string;
  orderNumber?: string;
  source?: 'CSV' | 'SHOPIFY' | 'GDRIVE' | 'MANUAL' | string;
  createdAt: string | FieldValue;
  updatedAt?: string | FieldValue;
  userId?: string;
  tenantId?: string;
  status?: string;
  paymentMethod?: string;
  customerName?: string;
  notes?: string;
}

export interface BusinessProfile {
  businessName: string;
  businessType: BusinessType;
  businessSize: BusinessSize;
  currency: string;
  country?: string;
  industry?: string;
  inventorySetupMethod?: string;
  timezone?: string;
  taxNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  shopifyConnected?: boolean;
  shopifyStoreUrl?: string;
  shopifyStoreName?: string;
  shopifyStatus?: string;
  shopifyAccessToken?: string;
  shopifyLastSyncedAt?: string;
  shopifyAutoSyncEnabled?: boolean;
  shopifyRealtimeSyncEnabled?: boolean;
  shopifySyncFrequency?: 'realtime' | '1_min' | '5_mins' | '15_mins' | '30_mins' | '1_hour' | '6_hours' | '12_hours' | 'daily' | 'weekly' | 'custom_datetime';
  shopifySyncTime?: string;
  shopifySyncDay?: string;
  shopifyScheduledDateTime?: string;
  shopifyWebhooksActive?: boolean;
  language?: string;
  logoUrl?: string;
  isOnboardingCompleted?: boolean;
  csvImportedAt?: string;
  createdAt?: string | FieldValue;
  updatedAt?: string | FieldValue;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  lowStockThreshold: number;
  emailNotifications: boolean;
  twoFactorAuth: boolean;
  apiAccess: boolean;
  language: string;
  notificationPreferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  categories: {
    inventory: boolean;
    suppliers: boolean;
    finance: boolean;
    forecasting: boolean;
    returns: boolean;
  };
  minPriority: 'CRITICAL' | 'HIGH' | 'ALL';
  emailAlerts: boolean;
  autoResolveAlerts: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  productCount?: number;
  createdAt?: string | FieldValue;
  updatedAt?: string | FieldValue;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  category?: string;
  leadTimeDays?: number;
  paymentTerms?: string;
  performanceScore?: number;
  rating?: number;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  userId?: string;
  tenantId?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Fulfilled';
  notes?: string;
  userId?: string;
  tenantId?: string;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
}

export interface ProductReturn {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  orderNumber?: string;
  quantity: number;
  customerName: string;
  reason: 'Defective' | 'Wrong Item' | 'Unopened / Buyer Remorse' | 'Damaged in Transit' | 'Other';
  actionTaken: 'Restocked' | 'Disposed / Written Off';
  refundStatus: 'Refunded' | 'Store Credit' | 'Pending' | 'Rejected';
  refundAmount: number;
  returnDate: string;
  notes?: string;
  source?: string;
  userId?: string;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
}

export interface CustomAttribute {
  id: string;
  label: string;
  value: string;
  createdAt?: string | FieldValue;
}

export type EventSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EventStatus = 'DETECTED' | 'ACTIVE' | 'ACKNOWLEDGED' | 'ACTION_TAKEN' | 'RESOLVED';

export type BusinessEventType =
  | 'STOCKOUT_RISK'
  | 'DEAD_STOCK_SURGE'
  | 'MARGIN_EROSION'
  | 'SUPPLIER_COST_INCREASE'
  | 'SUPPLIER_LEAD_TIME_SPIKE'
  | 'REVENUE_ANOMALY'
  | 'RETURN_RATE_SURGE'
  | 'HEALTH_SCORE_CHANGE'
  | 'FORECASTED_DEFICIT'
  | 'REVENUE_CONCENTRATION_RISK'
  | 'AT_RISK_CUSTOMERS'
  | 'CROSS_SELL_OPPORTUNITY';

export interface BusinessEvent {
  id: string;
  type: BusinessEventType;
  category: 'inventory' | 'suppliers' | 'finance' | 'forecasting' | 'returns';
  severity: EventSeverity;
  status: EventStatus;
  impactScore: number;
  entityId: string;
  entityName: string;
  title: string;
  description: string;
  impactFormatted: string;
  recommendation: string;
  firstDetected: string;
  lastUpdated: string;
  resolvedAt?: string;
  groupCount?: number;
  affectedItemNames?: string[];
  actionPayload?: {
    actionType: 'reorder' | 'discount' | 'price_up' | 'supplier' | 'navigate';
    targetRoute?: string;
    targetId?: string;
    reorderQty?: number;
  };
}

// --- PART 10: CUSTOMER & GROWTH INTELLIGENCE TYPES ---
export type CustomerSegment =
  | 'NEW'
  | 'RETURNING'
  | 'HIGH_VALUE'
  | 'LOYAL'
  | 'AT_RISK'
  | 'INACTIVE'
  | 'LOW_VALUE';

export interface CustomerProfile {
  id: string;
  name: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  recencyDays: number;
  typicalPurchaseIntervalDays: number;
  estimatedLtv: number;
  segment: CustomerSegment;
  segmentLabel: string;
  isAtRisk: boolean;
  atRiskReason?: string;
  purchasedProductIds: string[];
}

export interface CrossSellPair {
  primaryProductId: string;
  primaryProductName: string;
  suggestedProductId: string;
  suggestedProductName: string;
  coOccurrenceCount: number;
  confidencePercent: number;
  potentialRevenueImpact: number;
  recommendation: string;
}

export type OpportunityType =
  | 'product_growth'
  | 'customer_retention'
  | 'cross_sell'
  | 'upsell'
  | 'repeat_purchase'
  | 'pricing'
  | 'inventory_allocation';

export type OpportunityStatus = 'DETECTED' | 'ACCEPTED' | 'DISMISSED' | 'COMPLETED';

export interface GrowthOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  targetEntityName: string;
  opportunityScore: number; // 0 - 100
  expectedAdditionalRevenue: number;
  expectedAdditionalProfit: number;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceReason: string;
  recommendation: string;
  status: OpportunityStatus;
  detectedDate: string;
}

export interface GrowthReport {
  hasData: boolean;
  dataQualityMessage?: string;
  growthHealthScore: number; // 0 - 100
  scoreCategory: 'Aggressive Growth' | 'Healthy Trajectory' | 'Constrained Growth' | 'High Growth Risk';
  positiveDrivers: string[];
  growthBottlenecks: string[];
  totalCustomers: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  repeatPurchaseRatePercent: number;
  repeatPurchaseRatePriorPercent: number;
  repeatRateChangePoints: number;
  avgOrderValue: number;
  segmentsBreakdown: Record<CustomerSegment, number>;
  customersList: CustomerProfile[];
  atRiskCustomers: CustomerProfile[];
  crossSellOpportunities: CrossSellPair[];
  repeatPurchaseOpportunities: {
    customerName: string;
    lastPurchaseDaysAgo: number;
    typicalIntervalDays: number;
    recommendedAction: string;
  }[];
  revenueConcentration: {
    top5CustomersPercent: number;
    top3ProductsPercent: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    explanation: string;
  };
  opportunities: GrowthOpportunity[];
}

// --- PART 11: AI STRATEGY & BUSINESS SIMULATION TYPES ---
export type SimulationType =
  | 'PRICE_CHANGE'
  | 'DISCOUNT_PROMOTION'
  | 'INVENTORY_PURCHASE'
  | 'SUPPLIER_SWITCH'
  | 'SUPPLIER_COST_SPIKE'
  | 'DEMAND_CHANGE'
  | 'TARGET_PROFIT_GOAL';

export interface SimulationBaseline {
  revenue: number;
  grossProfit: number;
  profitMarginPercent: number;
  productPrice: number;
  productCost: number;
  stock: number;
  daysOfStock: number;
  dailyVelocity: number;
  supplierLeadTime: number;
  supplierReliability: number;
}

export interface SimulationResult {
  id: string;
  type: SimulationType;
  title: string;
  targetEntityName: string;
  baseline: SimulationBaseline;
  simulated: {
    newPrice?: number;
    newCost?: number;
    demandChangePercent?: number;
    projectedRevenue: number;
    projectedProfit: number;
    marginChangePercentagePoints: number;
    projectedStockRemaining: number;
    daysOfStockRemaining: number;
    capitalRequired: number;
    capitalRecovered: number;
    stockoutRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  };
  opportunityScore: number; // 0 - 100
  riskScore: number; // 0 - 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReason: string;
  assumptions: string[];
  risks: string[];
  recommendation: string;
  suggestedActionPayload?: {
    actionType: 'create_po' | 'adjust_price' | 'discount' | 'switch_supplier';
    targetId?: string;
    suggestedQty?: number;
    suggestedPrice?: number;
  };
}

export interface SavedScenario {
  id: string;
  name: string;
  createdDate: string;
  type: SimulationType;
  targetEntityName: string;
  inputs: Record<string, any>;
  result: SimulationResult;
}
