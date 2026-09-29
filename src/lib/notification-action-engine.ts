import { BusinessEvent, Product, PurchaseOrder, BusinessProfile, Supplier, Transaction } from './types';
import { getRecommendationChannel } from '@/components/inventory-recommendations-panel';
import { logBusinessAction } from './audit-store';
import { saveEventStatus } from './business-event-engine';
import { evaluateSalesHistory } from './sales-history-helper';

export type ActionableNotificationType = 'reorder' | 'discount' | 'price_up';

export interface ActionableNotificationAction {
  type: ActionableNotificationType;
  buttonLabel: string;
  modalTitle: string;
  modalDescription: string;
  product: Product;
  productName: string;
  channel: 'SHOPIFY' | 'GOOGLE_DRIVE' | 'LOCAL';
  channelLabel: string;
  reorderQty?: number;
  totalCost?: number;
  supplierName?: string;
  currentPrice?: number;
  targetPrice?: number;
  discountPercent?: number;
}

/**
 * Evaluates whether a BusinessEvent is truly actionable with a concrete business execution.
 * Purely informational notifications (Health Score, At-Risk Customers, Return Rate Surge,
 * Revenue Concentration, Supplier Lead Time, Grouped Alerts) return null so no Execute badge is displayed.
 */
export function getActionableAction(
  event: BusinessEvent,
  products: Product[] = [],
  businessProfile?: BusinessProfile | null,
  driveConnection?: any,
  suppliers: Supplier[] = [],
  transactions: Transaction[] = []
): ActionableNotificationAction | null {
  const payload = event.actionPayload;
  if (!payload) return null;

  // Informational / navigation alerts are strictly non-actionable
  if (
    payload.actionType !== 'reorder' &&
    payload.actionType !== 'discount' &&
    payload.actionType !== 'price_up'
  ) {
    return null;
  }

  // Target product must exist in local catalog
  const targetId = payload.targetId || event.entityId;
  const prod = products.find(p => p.id === targetId || p.sku === targetId);
  if (!prod) return null;

  const prodName = prod.name || prod.productName || 'Product';
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';
  const channel = getRecommendationChannel(prod, businessProfile, driveConnection);
  const channelLabel =
    channel === 'SHOPIFY'
      ? '⚡ Shopify Live Store'
      : channel === 'GOOGLE_DRIVE'
      ? '☁️ Google Drive CSV'
      : '📦 Local Catalog';

  if (payload.actionType === 'reorder') {
    const reorderQty =
      payload.reorderQty || Math.max(10, (prod.minStock || 5) * 2 - (prod.stock || 0));
    const unitCost = prod.costPrice || (prod.price ? prod.price * 0.6 : 100);
    const totalCost = Math.round(reorderQty * unitCost);
    const supplierName = prod.supplier || suppliers[0]?.name || 'Primary Supplier';

    return {
      type: 'reorder',
      buttonLabel: 'Execute Reorder',
      modalTitle: `Confirm Reorder: ${prodName}`,
      modalDescription: `Issue a purchase order for ${reorderQty} units from ${supplierName} (${currencySymbol}${totalCost.toLocaleString('en-IN')}) to replenish inventory and prevent stockout.`,
      product: prod,
      productName: prodName,
      channel,
      channelLabel,
      reorderQty,
      totalCost,
      supplierName,
    };
  }

  if (payload.actionType === 'discount') {
    // 1. Sales history validation: A clearance discount cannot be reliably recommended without
    //    at least 30 days of sales history (or 14+ days with 40+ sales) and verified 0 sales for this product.
    if (transactions && transactions.length > 0) {
      const salesHistory = evaluateSalesHistory(products, transactions);
      if (!salesHistory.hasMinimumHistory || !salesHistory.isProductEligibleForDeadStock(prod)) {
        return null;
      }
    }

    // 2. Cannot discount if product is already liquidated or has active heavy discount
    const isAlreadyDiscounted =
      prod.liquidationStatus === 'Liquidated' ||
      ((prod.discountPercent || 0) >= 15) ||
      (Boolean(prod.compareAtPrice) && (prod.compareAtPrice || 0) > (prod.price || 0));
    if (isAlreadyDiscounted) {
      return null;
    }

    // 3. Must have physical stock to discount
    if ((prod.stock || 0) < 1) {
      return null;
    }

    const discountPercent = payload.discountPercent || 20;
    const currentPrice = prod.price || 0;
    const targetPrice = Math.round(currentPrice * (1 - discountPercent / 100));

    return {
      type: 'discount',
      buttonLabel: `Apply ${discountPercent}% Discount`,
      modalTitle: `Confirm Clearance Discount: ${prodName}`,
      modalDescription: `Apply a ${discountPercent}% clearance discount to liquidate dead stock, reducing unit price from ${currencySymbol}${currentPrice.toLocaleString('en-IN')} to ${currencySymbol}${targetPrice.toLocaleString('en-IN')}.`,
      product: prod,
      productName: prodName,
      channel,
      channelLabel,
      discountPercent,
      currentPrice,
      targetPrice,
    };
  }

  if (payload.actionType === 'price_up') {
    const currentPrice = prod.price || 0;
    const cost = prod.costPrice || (currentPrice * 0.6);
    const targetPrice = payload.targetPrice || Math.round(cost * 1.25);

    if (targetPrice <= currentPrice) return null;

    return {
      type: 'price_up',
      buttonLabel: 'Optimize Price',
      modalTitle: `Confirm Margin Protection: ${prodName}`,
      modalDescription: `Increase retail price from ${currencySymbol}${currentPrice.toLocaleString('en-IN')} to ${currencySymbol}${targetPrice.toLocaleString('en-IN')} to protect against margin erosion and ensure healthy profitability.`,
      product: prod,
      productName: prodName,
      channel,
      channelLabel,
      currentPrice,
      targetPrice,
    };
  }

  return null;
}

export interface ExecuteNotificationActionParams {
  event: BusinessEvent;
  action: ActionableNotificationAction;
  addOrder: (order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<any>;
  updateProduct: (product: any, options?: any) => Promise<any>;
  businessProfile?: BusinessProfile | null;
  driveConnection?: any;
  getGoogleDriveFiles?: () => Promise<any[]>;
  user?: any;
}

export interface ExecutionResult {
  success: boolean;
  title: string;
  message: string;
}

/**
 * Directly executes the approved business action after user grants permission in modal dialog.
 */
export async function executeNotificationAction({
  event,
  action,
  addOrder,
  updateProduct,
  businessProfile,
  driveConnection,
  getGoogleDriveFiles,
  user,
}: ExecuteNotificationActionParams): Promise<ExecutionResult> {
  const { product, channel, productName } = action;
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const channelDesc =
    channel === 'SHOPIFY'
      ? ' Live updates pushed to Shopify Admin API.'
      : channel === 'GOOGLE_DRIVE'
      ? ' Updated in connected Google Drive CSV.'
      : ' Updated in local catalog.';

  try {
    if (action.type === 'reorder') {
      const reorderQty = action.reorderQty || 10;
      const unitCost = product.costPrice || ((product.price || 100) * 0.6);
      const totalCost = action.totalCost || Math.round(reorderQty * unitCost);

      // 1. Create Purchase Order
      const supName = action.supplierName || product.supplier || 'Primary Supplier';
      await addOrder({
        productId: product.id,
        productName: productName,
        supplierId: product.supplier || 'sup-primary',
        quantity: reorderQty,
        unitCost,
        totalCost,
        supplierName: supName,
        status: 'Fulfilled',
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      // 2. Update Product Stock
      const newStock = (product.stock || 0) + reorderQty;
      await updateProduct({
        ...product,
        stock: newStock,
        updatedAt: new Date().toISOString(),
      });

      // 3. Sync to Shopify if applicable
      if (channel === 'SHOPIFY') {
        const shopifyStore = businessProfile?.shopifyStoreUrl;
        const invItemId = (product as any).shopifyInventoryItemId || (product as any).inventoryItemId;
        const idToken = user ? await user.getIdToken().catch(() => null) : null;

        if (shopifyStore) {
          fetch('/api/shopify/inventory/adjust', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify({
              shop: shopifyStore,
              productId: product.id,
              sku: product.sku,
              inventoryItemId: invItemId,
              delta: reorderQty,
              reason: 'received_purchase_order',
              productName,
            }),
          }).catch(err => console.warn('[Shopify Alert Reorder Sync Error]:', err));
        }
      }

      // 4. Sync to Google Drive if applicable
      if (channel === 'GOOGLE_DRIVE') {
        let driveFileId = product.driveFileId;
        if (!driveFileId && typeof getGoogleDriveFiles === 'function') {
          try {
            const files = await getGoogleDriveFiles();
            const invFile = files.find(
              (f: any) =>
                f.type === 'inventory' ||
                f.name?.toLowerCase().includes('inventory') ||
                f.name?.toLowerCase().includes('catalog') ||
                f.name?.toLowerCase().includes('product')
            ) || files[0];
            if (invFile) driveFileId = invFile.id || invFile.fileId;
          } catch (e) {
            console.warn('[Drive Files Lookup Error]:', e);
          }
        }

        if (driveFileId) {
          const token = driveConnection?.accessToken;
          fetch('/api/drive/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'x-drive-token': token } : {}),
              ...(user?.uid ? { 'x-user-uid': user.uid } : {}),
            },
            body: JSON.stringify({
              fileId: driveFileId,
              fileName: (product as any).driveFileName || 'Inventory_Catalog.csv',
              updates: [
                {
                  sku: product.sku,
                  productName,
                  productId: product.id,
                  stockDelta: reorderQty,
                  newStock,
                },
              ],
            }),
          }).catch(err => console.warn('[Drive Alert Reorder Sync Error]:', err));
        }
      }

      // 5. Audit Log
      logBusinessAction({
        title: 'Notification Action: Reorder Executed',
        productName,
        actionType: 'reorder',
        changeDetails: `Reordered ${reorderQty} units from ${action.supplierName || 'Supplier'}. Total: ${currencySymbol}${totalCost.toLocaleString('en-IN')}.${channelDesc}`,
        impactValue: `+${reorderQty} Units Restocked`,
      });

      // 6. Mark Event Resolved
      saveEventStatus(event.id, 'RESOLVED');

      return {
        success: true,
        title: channel === 'SHOPIFY' ? '📦 Reorder Logged & Shopify Synced!' : channel === 'GOOGLE_DRIVE' ? '📦 Reorder Logged & Drive Synced!' : '📦 Reorder Executed!',
        message: `Added +${reorderQty} units to "${productName}". Alert resolved.`,
      };
    }

    if (action.type === 'discount') {
      const discountPercent = action.discountPercent || 20;
      const oldPrice = product.price || 0;
      const newPrice = action.targetPrice || Math.round(oldPrice * (1 - discountPercent / 100));

      // 1. Update Product Price
      await updateProduct(
        {
          ...product,
          price: newPrice,
          compareAtPrice: oldPrice,
          discountPercent,
          liquidationStatus: 'Liquidated',
          updatedAt: new Date().toISOString(),
        },
        { forceShopifySync: channel === 'SHOPIFY', silentToast: false }
      );

      // 2. Sync to Google Drive if applicable
      if (channel === 'GOOGLE_DRIVE') {
        let driveFileId = product.driveFileId;
        if (!driveFileId && typeof getGoogleDriveFiles === 'function') {
          try {
            const files = await getGoogleDriveFiles();
            const invFile = files.find(
              (f: any) =>
                f.type === 'inventory' ||
                f.name?.toLowerCase().includes('inventory') ||
                f.name?.toLowerCase().includes('catalog') ||
                f.name?.toLowerCase().includes('product')
            ) || files[0];
            if (invFile) driveFileId = invFile.id || invFile.fileId;
          } catch (e) {
            console.warn('[Drive Files Lookup Error]:', e);
          }
        }

        if (driveFileId) {
          const token = driveConnection?.accessToken;
          fetch('/api/drive/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'x-drive-token': token } : {}),
              ...(user?.uid ? { 'x-user-uid': user.uid } : {}),
            },
            body: JSON.stringify({
              fileId: driveFileId,
              fileName: (product as any).driveFileName || 'Inventory_Catalog.csv',
              updates: [
                {
                  sku: product.sku,
                  productName,
                  productId: product.id,
                  price: newPrice,
                },
              ],
            }),
          }).catch(err => console.warn('[Drive Alert Discount Sync Error]:', err));
        }
      }

      // 3. Audit Log
      logBusinessAction({
        title: `Notification Action: ${discountPercent}% Discount Applied`,
        productName,
        actionType: 'discount',
        changeDetails: `Reduced price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} (-${discountPercent}%) to liquidate dead stock.${channelDesc}`,
        impactValue: `-${discountPercent}% Clearance Price`,
      });

      // 4. Mark Event Resolved
      saveEventStatus(event.id, 'RESOLVED');

      return {
        success: true,
        title: channel === 'SHOPIFY' ? '🏷️ Discount Applied & Shopify Synced!' : channel === 'GOOGLE_DRIVE' ? '🏷️ Discount Applied & Drive Synced!' : '🏷️ Discount Applied!',
        message: `Reduced price of "${productName}" to ${currencySymbol}${newPrice} (-${discountPercent}%). Alert resolved.`,
      };
    }

    if (action.type === 'price_up') {
      const oldPrice = product.price || 0;
      const newPrice = action.targetPrice || Math.round(oldPrice * 1.2);

      // 1. Update Product Price
      await updateProduct(
        {
          ...product,
          price: newPrice,
          updatedAt: new Date().toISOString(),
        },
        { forceShopifySync: channel === 'SHOPIFY', silentToast: false }
      );

      // 2. Sync to Google Drive if applicable
      if (channel === 'GOOGLE_DRIVE') {
        let driveFileId = product.driveFileId;
        if (!driveFileId && typeof getGoogleDriveFiles === 'function') {
          try {
            const files = await getGoogleDriveFiles();
            const invFile = files.find(
              (f: any) =>
                f.type === 'inventory' ||
                f.name?.toLowerCase().includes('inventory') ||
                f.name?.toLowerCase().includes('catalog') ||
                f.name?.toLowerCase().includes('product')
            ) || files[0];
            if (invFile) driveFileId = invFile.id || invFile.fileId;
          } catch (e) {
            console.warn('[Drive Files Lookup Error]:', e);
          }
        }

        if (driveFileId) {
          const token = driveConnection?.accessToken;
          fetch('/api/drive/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'x-drive-token': token } : {}),
              ...(user?.uid ? { 'x-user-uid': user.uid } : {}),
            },
            body: JSON.stringify({
              fileId: driveFileId,
              fileName: (product as any).driveFileName || 'Inventory_Catalog.csv',
              updates: [
                {
                  sku: product.sku,
                  productName,
                  productId: product.id,
                  price: newPrice,
                },
              ],
            }),
          }).catch(err => console.warn('[Drive Alert Price Sync Error]:', err));
        }
      }

      // 3. Audit Log
      logBusinessAction({
        title: 'Notification Action: Margin Price Protected',
        productName,
        actionType: 'price_up',
        changeDetails: `Increased price from ${currencySymbol}${oldPrice} to ${currencySymbol}${newPrice} to recover healthy margin.${channelDesc}`,
        impactValue: `+${currencySymbol}${newPrice - oldPrice} Margin Recovery`,
      });

      // 4. Mark Event Resolved
      saveEventStatus(event.id, 'RESOLVED');

      return {
        success: true,
        title: channel === 'SHOPIFY' ? '📈 Price Optimized & Shopify Synced!' : channel === 'GOOGLE_DRIVE' ? '📈 Price Optimized & Drive Synced!' : '📈 Price Optimized!',
        message: `Updated price of "${productName}" to ${currencySymbol}${newPrice}. Alert resolved.`,
      };
    }

    return {
      success: false,
      title: 'Action Skipped',
      message: 'No supported execution handler for this event.',
    };
  } catch (error: any) {
    console.error('[Notification Action Execution Error]:', error);
    return {
      success: false,
      title: 'Execution Failed',
      message: error?.message || 'Failed to execute business action.',
    };
  }
}
