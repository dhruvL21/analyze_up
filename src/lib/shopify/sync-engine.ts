/**
 * Paginated, Resumable Multi-Tenant Synchronization Engine
 * Handles Products, Multi-Location Inventory, Sales Orders, Multi-Refunds, and Returns via GraphQL.
 * Uses privileged Firebase Admin SDK for trusted server-side persistence.
 */

import { getAdminFirestore, PersistenceError } from '@/lib/firebase/admin';
import { executeShopifyGraphQL } from './admin-api';
import { getShopifyConnection, updateConnectionSyncStatus } from './connection-store';
import { getShopifyScopes, sanitizeShopDomain, getMissingCoreScopes } from './config';
import type {
  ShopifySyncJob,
  ShopifyRefundRecord,
  ShopifyReturnRecord,
  ShopifySalesOrderRecord,
} from './types';

// Local in-memory sync jobs cache for resilient development mode
const memorySyncJobs = new Map<string, ShopifySyncJob>();

export function getMemorySyncJob(jobId: string): ShopifySyncJob | null {
  return memorySyncJobs.get(jobId) || null;
}

/**
 * Creates or initialises a new sync job record in Firestore via Admin SDK.
 */
export async function createSyncJob(
  tenantId: string,
  rawShop: string,
  syncType: ShopifySyncJob['syncType'] = 'ALL'
): Promise<string> {
  const shop = sanitizeShopDomain(rawShop) || rawShop;
  const jobId = `job_${shop}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const jobData: ShopifySyncJob = {
    jobId,
    tenantId,
    shop,
    syncType,
    status: 'PENDING',
    cursor: null,
    progress: {
      products: 0,
      inventory: 0,
      orders: 0,
      refunds: 0,
      returns: 0,
      totalProcessed: 0,
    },
    errors: [],
    startedAt: null,
    failedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memorySyncJobs.set(jobId, jobData);

  try {
    const db = getAdminFirestore();
    const jobRef = db.collection('shopify_sync_jobs').doc(jobId);
    await jobRef.set(jobData);
    console.log(`[Shopify Sync] Created sync job ${jobId} for ${shop} (tenant: ${tenantId})`);
  } catch (err: any) {
    console.warn('[Sync Engine] Firestore sync job write notice:', err?.message || err);
    const isExplicitCredentialsConfigured = !!(
      (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    if (isExplicitCredentialsConfigured && process.env.NODE_ENV === 'production') {
      throw new PersistenceError('FIRESTORE_WRITE_FAILED', `Failed to create sync job: ${err?.message || err}`, err);
    }
  }

  return jobId;
}

/**
 * Executes a sync job with GraphQL cursor pagination and checkpoint resumption.
 */
export async function runShopifySyncJob(
  jobId: string,
  rawShop: string,
  tenantId: string,
  options?: { cursor?: string; syncType?: string }
): Promise<{
  success: boolean;
  jobId: string;
  errorCode?: string;
  errorMessage?: string;
  stats: {
    products: number;
    inventory: number;
    orders: number;
    refunds: number;
    returns: number;
  };
}> {
  const shop = sanitizeShopDomain(rawShop) || rawShop;
  const db = getAdminFirestore();
  const jobRef = db.collection('shopify_sync_jobs').doc(jobId);

  const stats = {
    products: 0,
    inventory: 0,
    orders: 0,
    refunds: 0,
    returns: 0,
  };

  const syncType = options?.syncType || 'ALL';

  // 1. Load connection and verify tenant ownership
  const connection = await getShopifyConnection(shop);
  if (!connection) {
    const errorMsg = `No Shopify connection found for store: ${shop}`;
    await jobRef.set({
      status: 'FAILED',
      errorCode: 'SHOPIFY_AUTH_FAILED',
      errorMessage: errorMsg,
      errors: [errorMsg],
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
    return { success: false, jobId, errorCode: 'SHOPIFY_AUTH_FAILED', errorMessage: errorMsg, stats };
  }

  if (connection.tenantId !== tenantId) {
    const errorMsg = `Tenant mismatch: Store ${shop} is not owned by tenant ${tenantId}`;
    await jobRef.set({
      status: 'FAILED',
      errorCode: 'TENANT_MISMATCH',
      errorMessage: errorMsg,
      errors: [errorMsg],
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
    return { success: false, jobId, errorCode: 'TENANT_MISMATCH', errorMessage: errorMsg, stats };
  }

  // 2. Verify core scopes before running GraphQL queries
  const granted = connection.grantedScopes || [];
  const missingCore = getMissingCoreScopes(granted);

  if (missingCore.length > 0) {
    const errorMsg = `The Shopify installation is missing required access scopes: ${missingCore.join(', ')}. Please reauthorize the application.`;
    console.warn(`[Shopify Sync] Job ${jobId} failed: Missing core scopes [${missingCore.join(', ')}]`);
    await jobRef.set({
      status: 'FAILED',
      errorCode: 'SHOPIFY_MISSING_SCOPE',
      errorMessage: errorMsg,
      errors: [errorMsg],
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
    return { success: false, jobId, errorCode: 'SHOPIFY_MISSING_SCOPE', errorMessage: errorMsg, stats };
  }

  // 3. Mark job RUNNING and ensure parent user document is initialized
  await jobRef.set({
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true }).catch(() => {});

  // Ensure root user document exists in Firestore
  await db.collection('users').doc(tenantId).set({
    uid: tenantId,
    role: 'merchant',
    connectedShopifyStore: shop,
    shopifyConnected: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true }).catch((e) => console.warn('[Sync Engine] Root user doc set notice:', e?.message || e));

  try {
    // -------------------------------------------------------------
    // STEP 1: Sync Products & Multi-Location Inventory Levels
    // -------------------------------------------------------------
    if (syncType === 'ALL' || syncType === 'PRODUCTS' || syncType === 'INVENTORY') {
      let hasNextPage = true;
      let productCursor = options?.cursor || null;

      const hasReadLocations = (connection.grantedScopes || []).includes('read_locations');
      const locationSubfields = hasReadLocations ? 'id\n                          name' : 'id';

      const productQuery = `
        query GetProductsPaginated($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
              handle
              vendor
              productType
              status
              images(first: 1) {
                nodes {
                  url
                }
              }
              variants(first: 50) {
                nodes {
                  id
                  title
                  sku
                  barcode
                  price
                  compareAtPrice
                  inventoryQuantity
                  inventoryItem {
                    id
                    inventoryLevels(first: 20) {
                      nodes {
                        id
                        location {
                          ${locationSubfields}
                        }
                        quantities(names: ["available"]) {
                          name
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      while (hasNextPage) {
        const data = await executeShopifyGraphQL<{
          products: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: any[];
          };
        }>({
          shop,
          query: productQuery,
          variables: { first: 50, after: productCursor },
        });

        const nodes = data?.products?.nodes || [];
        let batch = db.batch();
        let batchCount = 0;

        for (const p of nodes) {
          const rawProdId = p.id.replace('gid://shopify/Product/', '');
          const imageUrl = p.images?.nodes?.[0]?.url || '';

          for (const v of p.variants?.nodes || []) {
            const rawVarId = v.id.replace('gid://shopify/ProductVariant/', '');
            const rawInvItemId = v.inventoryItem?.id ? v.inventoryItem.id.replace('gid://shopify/InventoryItem/', '') : '';
            const productDocId = `shopify_${rawProdId}_${rawVarId}`;
            const price = Number(v.price) || 0;
            const costPrice = Math.round(price * 0.6);
            const stock = Number(v.inventoryQuantity !== undefined ? v.inventoryQuantity : 0);
            const compareAtPrice = v.compareAtPrice ? Number(v.compareAtPrice) : null;
            const sku = v.sku || (v.barcode ? v.barcode : `SKU-${rawProdId}-${rawVarId}`);
            const variantTitle = v.title && v.title !== 'Default Title' ? ` (${v.title})` : '';

            // 1. Save product in master catalog subcollection
            const prodRef = db.collection('users').doc(tenantId).collection('products').doc(productDocId);
            const prodPayload = {
              id: productDocId,
              name: `${p.title}${variantTitle}`,
              sku,
              category: p.productType || 'General',
              price,
              costPrice,
              stock,
              reorderPoint: Math.max(5, Math.round(stock * 0.2)),
              supplier: p.vendor || 'Shopify Vendor',
              source: 'SHOPIFY',
              importSource: 'shopify',
              shopifyProductId: rawProdId,
              shopifyVariantId: rawVarId,
              shopifyInventoryItemId: rawInvItemId,
              barcode: v.barcode || null,
              imageUrl,
              status: p.status,
              compareAtPrice,
              tenantId,
              userId: tenantId,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            batch.set(prodRef, prodPayload, { merge: true });

            // 1b. Save product in dedicated shopify_products subcollection
            const shopifyProdRef = db.collection('users').doc(tenantId).collection('shopify_products').doc(productDocId);
            batch.set(shopifyProdRef, prodPayload, { merge: true });
            batchCount += 2;
            stats.products++;

            // 2. Save per-location inventory records
            for (const level of v.inventoryItem?.inventoryLevels?.nodes || []) {
              const rawLocId = level.location?.id ? level.location.id.replace('gid://shopify/Location/', '') : 'default';
              const defaultLocName = connection.storeName ? `${connection.storeName} Warehouse` : 'Main Warehouse';
              const locName = level.location?.name || defaultLocName;
              const availableQty = level.quantities?.find((q: any) => q.name === 'available')?.quantity || 0;
              const inventoryDocId = `${rawInvItemId}_${rawLocId}`;

              const invRef = db.collection('users').doc(tenantId).collection('inventory').doc(inventoryDocId);
              batch.set(invRef, {
                id: inventoryDocId,
                tenantId,
                inventoryItemId: rawInvItemId,
                locationId: rawLocId,
                locationName: locName,
                sku,
                productName: `${p.title}${variantTitle}`,
                availableQuantity: availableQty,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
              batchCount++;
              stats.inventory++;
            }

            if (batchCount >= 400) {
              await batch.commit().catch((err: any) => console.warn('[Sync Engine] Products batch commit notice:', err?.message || err));
              batch = db.batch();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit().catch((err: any) => console.warn('[Sync Engine] Products batch commit notice:', err?.message || err));
        }

        hasNextPage = Boolean(data?.products?.pageInfo?.hasNextPage);
        productCursor = data?.products?.pageInfo?.endCursor || null;

        // Save progress checkpoint
        await jobRef.set({
          cursor: productCursor,
          progress: { ...stats, totalProcessed: stats.products + stats.orders },
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Sync Sales Orders, Partial Refunds, and Refund Items
    // -------------------------------------------------------------
    if (syncType === 'ALL' || syncType === 'ORDERS' || syncType === 'REFUNDS') {
      let hasNextOrders = true;
      let orderCursor = null;

      const orderQuery = `
        query GetOrdersPaginated($first: Int!, $after: String) {
          orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              name
              createdAt
              processedAt
              currencyCode
              displayFinancialStatus
              displayFulfillmentStatus
              subtotalPriceSet { shopMoney { amount } }
              totalDiscountsSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              totalPriceSet { shopMoney { amount } }
              customer {
                firstName
                lastName
                email
              }
              lineItems(first: 50) {
                nodes {
                  id
                  title
                  sku
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  product { id }
                  variant { id }
                }
              }
              refunds(first: 20) {
                id
                createdAt
                note
                totalRefundedSet { shopMoney { amount } }
                refundLineItems(first: 50) {
                  nodes {
                    id
                    quantity
                    subtotalSet { shopMoney { amount } }
                    totalTaxSet { shopMoney { amount } }
                    lineItem {
                      id
                      title
                      sku
                      product { id }
                      variant { id }
                    }
                  }
                }
                transactions(first: 10) {
                  nodes {
                    id
                    kind
                    status
                    gateway
                    amountSet { shopMoney { amount } }
                  }
                }
              }
            }
          }
        }
      `;

      while (hasNextOrders) {
        const data: any = await executeShopifyGraphQL<{
          orders: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: any[];
          };
        }>({
          shop,
          query: orderQuery,
          variables: { first: 50, after: orderCursor },
        });

        const orderNodes = data?.orders?.nodes || [];
        let batch = db.batch();
        let batchCount = 0;

        for (const o of orderNodes) {
          const rawOrderId = o.id.replace('gid://shopify/Order/', '');
          const customerName = o.customer
            ? `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() || 'Online Customer'
            : 'Shopify Customer';
          const totalPrice = Number(o.totalPriceSet?.shopMoney?.amount) || 0;

          // 1. Save Sales Order record in sales_orders and shopify_orders
          const salesOrderDocId = `order_${rawOrderId}`;
          const salesOrderRef = db.collection('users').doc(tenantId).collection('sales_orders').doc(salesOrderDocId);
          const shopifyOrderRef = db.collection('users').doc(tenantId).collection('shopify_orders').doc(salesOrderDocId);
          const orderPayload = {
            id: salesOrderDocId,
            shopifyOrderId: rawOrderId,
            orderNumber: o.name || `#${rawOrderId}`,
            tenantId,
            customerName,
            customerEmail: o.customer?.email || null,
            financialStatus: o.displayFinancialStatus || 'PAID',
            fulfillmentStatus: o.displayFulfillmentStatus || 'UNFULFILLED',
            currency: o.currencyCode || 'USD',
            subtotalPrice: Number(o.subtotalPriceSet?.shopMoney?.amount) || 0,
            totalDiscounts: Number(o.totalDiscountsSet?.shopMoney?.amount) || 0,
            totalTax: Number(o.totalTaxSet?.shopMoney?.amount) || 0,
            totalPrice,
            lineItemsCount: o.lineItems?.nodes?.length || 0,
            lineItems: (o.lineItems?.nodes || []).map((li: any) => ({
              id: li.id,
              title: li.title,
              sku: li.sku || '',
              quantity: Number(li.quantity) || 1,
              price: Number(li.originalUnitPriceSet?.shopMoney?.amount) || 0,
              productId: li.product?.id ? li.product.id.replace('gid://shopify/Product/', '') : '',
              variantId: li.variant?.id ? li.variant.id.replace('gid://shopify/ProductVariant/', '') : '',
            })),
            processedAt: o.processedAt || o.createdAt,
            source: 'SHOPIFY',
            importSource: 'shopify',
            createdAt: o.createdAt,
            updatedAt: new Date().toISOString(),
          };
          batch.set(salesOrderRef, orderPayload, { merge: true });
          batch.set(shopifyOrderRef, orderPayload, { merge: true });
          batchCount += 2;
          stats.orders++;

          // 1b. Populate canonical line-item transactions for analytics & executive KPI fidelity
          const rawFinStatus = String(o.displayFinancialStatus || 'PAID').toUpperCase();
          const rawFulStatus = String(o.displayFulfillmentStatus || 'UNFULFILLED').toUpperCase();
          const isOrderPaid = rawFinStatus === 'PAID' || rawFinStatus === 'PARTIALLY_REFUNDED';
          const isOrderFulfilled = rawFulStatus === 'FULFILLED' || rawFulStatus === 'DELIVERED';
          const orderDateStr = (o.processedAt || o.createdAt || new Date().toISOString()).split('T')[0];

          for (const li of o.lineItems?.nodes || []) {
            const rawLiId = li.id.replace('gid://shopify/LineItem/', '');
            const txDocId = `tx_shopify_${rawOrderId}_${rawLiId}`;
            const txRef = db.collection('users').doc(tenantId).collection('transactions').doc(txDocId);
            const unitPrice = Number(li.originalUnitPriceSet?.shopMoney?.amount) || 0;
            const qty = Number(li.quantity) || 1;
            const prodGid = li.product?.id ? li.product.id.replace('gid://shopify/Product/', '') : '';
            const varGid = li.variant?.id ? li.variant.id.replace('gid://shopify/ProductVariant/', '') : '';
            const prodDocId = varGid ? `shopify_${prodGid}_${varGid}` : (prodGid ? `shopify_${prodGid}` : `prod_${rawLiId}`);

            batch.set(txRef, {
              id: txDocId,
              tenantId,
              userId: tenantId,
              orderNumber: o.name || `#${rawOrderId}`,
              shopifyOrderId: rawOrderId,
              productId: prodDocId,
              productName: li.title || 'Shopify Product',
              sku: li.sku || 'N/A',
              type: 'Sale',
              quantity: qty,
              unitPrice,
              price: unitPrice,
              totalRevenue: unitPrice * qty,
              costPrice: Math.round(unitPrice * 0.6),
              totalCost: Math.round(unitPrice * 0.6 * qty),
              customerName,
              financialStatus: rawFinStatus,
              fulfillmentStatus: rawFulStatus,
              paymentReceived: isOrderPaid,
              isRevenueRecognized: isOrderFulfilled,
              status: isOrderFulfilled ? 'Delivered' : 'Pending',
              deliveryStatus: isOrderFulfilled ? 'DELIVERED' : 'PENDING',
              transactionDate: orderDateStr,
              source: 'SHOPIFY',
              createdAt: o.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            batchCount++;
          }

          // 2. Save Refunds
          for (const ref of o.refunds || []) {
            const rawRefundId = ref.id.replace('gid://shopify/Refund/', '');
            const refundDocId = `ref_${rawOrderId}_${rawRefundId}`;
            const refundAmount = Number(ref.totalRefundedSet?.shopMoney?.amount) || 0;

            const refundRef = db.collection('users').doc(tenantId).collection('refunds').doc(refundDocId);
            batch.set(refundRef, {
              id: refundDocId,
              shopifyRefundId: rawRefundId,
              shopifyOrderId: rawOrderId,
              orderNumber: o.name || `#${rawOrderId}`,
              tenantId,
              amount: refundAmount,
              currency: o.currencyCode || 'USD',
              note: ref.note || '',
              processedAt: ref.createdAt,
              createdAt: ref.createdAt,
              refundLineItems: (ref.refundLineItems?.nodes || []).map((rli: any) => ({
                id: rli.id,
                lineItemId: rli.lineItem?.id || '',
                productId: rli.lineItem?.product?.id ? rli.lineItem.product.id.replace('gid://shopify/Product/', '') : '',
                variantId: rli.lineItem?.variant?.id ? rli.lineItem.variant.id.replace('gid://shopify/ProductVariant/', '') : '',
                sku: rli.lineItem?.sku || '',
                title: rli.lineItem?.title || '',
                quantity: Number(rli.quantity) || 1,
                subtotal: Number(rli.subtotalSet?.shopMoney?.amount) || 0,
                totalTax: Number(rli.totalTaxSet?.shopMoney?.amount) || 0,
              })),
              refundTransactions: (ref.transactions?.nodes || ref.transactions || []).map((tx: any) => ({
                id: tx.id,
                amount: Number(tx.amountSet?.shopMoney?.amount) || 0,
                currency: o.currencyCode || 'USD',
                kind: tx.kind || 'refund',
                status: tx.status || 'success',
                gateway: tx.gateway || 'shopify',
              })),
              source: 'SHOPIFY',
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            batchCount++;
            stats.refunds++;
          }

          if (batchCount >= 400) {
            await batch.commit().catch((err: any) => console.warn('[Sync Engine] Orders batch commit notice:', err?.message || err));
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit().catch((err: any) => console.warn('[Sync Engine] Orders batch commit notice:', err?.message || err));
        }

        hasNextOrders = Boolean(data?.orders?.pageInfo?.hasNextPage);
        orderCursor = data?.orders?.pageInfo?.endCursor || null;

        // Checkpoint
        await jobRef.set({
          progress: {
            ...stats,
            totalProcessed: stats.products + stats.orders + stats.refunds,
          },
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Optional Returns Sync
    // -------------------------------------------------------------
    if (syncType === 'ALL' || syncType === 'RETURNS') {
      try {
        const returnQuery = `
          query GetReturnsPaginated($first: Int!) {
            returns(first: $first, reverse: true) {
              nodes {
                id
                name
                status
                createdAt
                order {
                  id
                  name
                  customer { firstName lastName }
                }
                returnLineItems(first: 20) {
                  nodes {
                    id
                    quantity
                    returnReason
                    returnReasonNote
                    fulfillmentLineItem {
                      lineItem { id title sku }
                    }
                  }
                }
              }
            }
          }
        `;

        const retData: any = await executeShopifyGraphQL({
          shop,
          query: returnQuery,
          variables: { first: 50 },
        }).catch(() => null);

        const returnNodes = retData?.returns?.nodes || [];
        let batch = db.batch();
        let batchCount = 0;

        for (const ret of returnNodes) {
          const rawReturnId = ret.id.replace('gid://shopify/Return/', '');
          const rawOrderId = ret.order?.id ? ret.order.id.replace('gid://shopify/Order/', '') : '';
          const returnDocId = `ret_${rawOrderId}_${rawReturnId}`;
          const customerName = ret.order?.customer
            ? `${ret.order.customer.firstName || ''} ${ret.order.customer.lastName || ''}`.trim() || 'Customer'
            : 'Shopify Customer';

          const returnItems = (ret.returnLineItems?.nodes || []).map((rli: any) => ({
            id: rli.id,
            quantity: Number(rli.quantity) || 1,
            title: rli.fulfillmentLineItem?.lineItem?.title || 'Returned Item',
            sku: rli.fulfillmentLineItem?.lineItem?.sku || '',
            returnReason: rli.returnReason || null,
            returnReasonNote: rli.returnReasonNote || null,
          }));

          const returnRef = db.collection('users').doc(tenantId).collection('returns').doc(returnDocId);
          batch.set(returnRef, {
            id: returnDocId,
            shopifyReturnId: rawReturnId,
            shopifyOrderId: rawOrderId,
            orderNumber: ret.order?.name || `#${rawOrderId}`,
            tenantId,
            customerName,
            status: ret.status || 'CLOSED',
            actionTaken: 'Restocked',
            refundStatus: 'Refunded',
            refundAmount: 0,
            returnDate: ret.createdAt.split('T')[0],
            returnItems,
            source: 'SHOPIFY',
            createdAt: ret.createdAt,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          batchCount++;
          stats.returns++;

          if (batchCount >= 400) {
            await batch.commit().catch((err: any) => console.warn('[Sync Engine] Returns batch commit notice:', err?.message || err));
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit().catch((err: any) => console.warn('[Sync Engine] Returns batch commit notice:', err?.message || err));
        }
      } catch (retErr) {
        console.warn(`[Sync Engine] Optional returns query note for ${shop}:`, retErr);
      }
    }

    // 4. Mark Sync Job Completed
    await jobRef.set({
      status: 'COMPLETED',
      progress: { ...stats, totalProcessed: stats.products + stats.orders + stats.refunds + stats.returns },
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});

    await updateConnectionSyncStatus(shop, 'SYNCED', stats);

    console.log(`[Shopify Sync] Completed job ${jobId} for ${shop}: ${stats.products} products, ${stats.inventory} inventory, ${stats.orders} orders.`);
    return { success: true, jobId, stats };
  } catch (error: any) {
    console.error(`[Sync Engine] Job ${jobId} error for ${shop}:`, error?.message || error);

    const isScopeError =
      error?.errorCode === 'SHOPIFY_MISSING_SCOPE' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('access scope') ||
          error.message.includes('read_locations') ||
          error.message.includes('write_inventory') ||
          error.message.includes('Access denied')));

    const errorCode = isScopeError
      ? 'SHOPIFY_MISSING_SCOPE'
      : error?.code === 'FIRESTORE_WRITE_FAILED'
      ? 'FIRESTORE_WRITE_FAILED'
      : error?.name === 'ShopifyGraphQLError'
      ? 'SHOPIFY_GRAPHQL_ERROR'
      : 'SYNC_FAILED';

    const errorMessage = error?.message || 'Sync job execution error';

    await jobRef.set({
      status: 'FAILED',
      errorCode,
      errorMessage,
      errors: [errorMessage],
      failedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});

    await updateConnectionSyncStatus(shop, 'ACTIVE', stats).catch(() => {});

    return {
      success: false,
      jobId,
      errorCode,
      errorMessage,
      stats,
    };
  }
}
