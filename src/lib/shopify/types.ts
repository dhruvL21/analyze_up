/**
 * Shopify Multi-Tenant Data Types & Models
 */

export type ShopifyConnectionStatus =
  | 'ACTIVE'
  | 'SYNCING'
  | 'SYNCED'
  | 'PARTIAL'
  | 'FAILED'
  | 'UNINSTALLED'
  | 'DISCONNECTED';

export interface ShopifyConnectionRecord {
  id: string; // e.g. "conn_${tenantId}_${shopDomain}" or shopDomain
  tenantId: string; // AnalyzeUp user/tenant ID
  shopDomain: string; // Normalized 'store.myshopify.com'
  encryptedAccessToken: string; // AES-256-GCM cipher
  encryptedRefreshToken: string | null; // AES-256-GCM cipher
  accessTokenExpiresAt: string | null; // ISO Date string
  refreshTokenExpiresAt: string | null; // ISO Date string
  lastTokenRefreshAt: string | null;
  status: ShopifyConnectionStatus;
  requestedScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  storeName: string;
  companyName?: string;
  logoUrl?: string;
  currency: string;
  storeEmail?: string;
  shopId?: string;
  primaryLocationId: string | null;
  installedAt: string;
  uninstalledAt: string | null;
  lastSyncAt: string | null;
  syncStats?: {
    productsCount?: number;
    inventoryCount?: number;
    ordersCount?: number;
    refundsCount?: number;
    returnsCount?: number;
    lastSyncedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyOAuthStateRecord {
  nonce: string;
  tenantId: string;
  normalizedShopDomain: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export type ShopifySyncJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export interface ShopifySyncJob {
  jobId: string;
  tenantId: string;
  shop: string;
  syncType: 'ALL' | 'PRODUCTS' | 'INVENTORY' | 'ORDERS' | 'REFUNDS' | 'RETURNS';
  status: ShopifySyncJobStatus;
  errorCode?: string;
  errorMessage?: string;
  cursor: string | null;
  progress: {
    products?: number;
    inventory?: number;
    orders?: number;
    refunds?: number;
    returns?: number;
    totalProcessed?: number;
  };
  errors: string[];
  startedAt?: string | null;
  failedAt?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyOutgoingOperation {
  operationId: string;
  tenantId: string;
  shop: string;
  resourceType: 'INVENTORY' | 'PRODUCT_PRICE' | 'ORDER';
  resourceId: string;
  mutationType: string;
  createdAt: string;
  status: 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';
}

export interface ShopifyRefundLineItem {
  id: string;
  lineItemId: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  subtotal: number;
  totalTax: number;
  restockType?: string;
  locationId?: string;
}

export interface ShopifyRefundTransaction {
  id: string;
  amount: number;
  currency: string;
  kind: string; // 'refund'
  status: string; // 'success'
  gateway: string;
}

export interface ShopifyRefundRecord {
  id: string; // `ref_shopify_${orderId}_${refundId}`
  shopifyRefundId: string;
  shopifyOrderId: string;
  orderNumber: string;
  tenantId: string;
  amount: number;
  currency: string;
  createdAt: string;
  processedAt: string;
  note?: string;
  associatedReturnId?: string | null;
  refundLineItems: ShopifyRefundLineItem[];
  refundTransactions: ShopifyRefundTransaction[];
  source: 'SHOPIFY';
  updatedAt: string;
}

export interface ShopifyReturnItem {
  id: string;
  lineItemId: string;
  productId: string;
  variantId?: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  returnReason?: string;
  returnReasonNote?: string;
}

export interface ShopifyReturnRecord {
  id: string; // `ret_shopify_${orderId}_${returnId}`
  shopifyReturnId: string;
  shopifyOrderId: string;
  orderNumber: string;
  tenantId: string;
  customerName: string;
  status: 'REQUESTED' | 'APPROVED' | 'DECLINED' | 'IN_TRANSIT' | 'PROCESSING' | 'RESTOCKED' | 'CLOSED' | 'CANCELLED';
  actionTaken: 'Restocked' | 'Disposed / Written Off';
  refundStatus: 'Refunded' | 'Store Credit' | 'Pending' | 'Rejected';
  refundAmount: number;
  returnDate: string;
  associatedRefundId?: string | null;
  returnItems: ShopifyReturnItem[];
  source: 'SHOPIFY';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifySalesOrderRecord {
  id: string; // `sales_order_shopify_${orderId}`
  shopifyOrderId: string;
  orderNumber: string;
  tenantId: string;
  customerName: string;
  customerEmail?: string;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalPrice: number;
  totalDiscounts: number;
  totalTax: number;
  totalPrice: number;
  lineItemsCount: number;
  lineItems: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    sku: string;
    quantity: number;
    price: number;
  }>;
  processedAt: string;
  source: 'SHOPIFY';
  createdAt: string;
  updatedAt: string;
}
