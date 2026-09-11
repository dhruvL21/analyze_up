/**
 * Ingestion: Shopify Data Adapter
 * Converts raw Shopify API responses (products, orders) into tabular rows for Model 1 mapping.
 */
import { ParsedTabularData } from './csv-parser';

export function parseShopifyProducts(shopifyProducts: any[]): ParsedTabularData {
  const rows: Record<string, any>[] = [];

  shopifyProducts.forEach((p) => {
    const title = p.title || p.name || 'Untitled Product';
    const category = p.product_type || p.category || 'General';
    const vendor = p.vendor || p.supplier || '';
    const description = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '') : (p.description || '');

    const variants = p.variants && p.variants.length > 0 ? p.variants : [{
      price: p.price || 0,
      sku: p.sku || `SHOPIFY-${p.id}`,
      inventory_quantity: p.inventory_quantity || 0,
    }];

    variants.forEach((v: any) => {
      rows.push({
        'Shopify Product ID': String(p.id || ''),
        'Item Title': variants.length > 1 ? `${title} - ${v.title || 'Variant'}` : title,
        'SKU Code': String(v.sku || `SKU-${p.id}`),
        'Product Category': category,
        'Selling Price': String(v.price || '0'),
        'Cost Price': String(v.cost || Math.round(Number(v.price || 0) * 0.6)),
        'Available Inventory': String(v.inventory_quantity !== undefined ? v.inventory_quantity : 0),
        'Vendor Name': vendor,
        'Description': description,
      });
    });
  });

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    rowCount: rows.length,
    rawText: JSON.stringify(shopifyProducts, null, 2),
    delimiter: ',',
  };
}

export function parseShopifyOrders(shopifyOrders: any[]): ParsedTabularData {
  const rows: Record<string, any>[] = [];

  shopifyOrders.forEach((order) => {
    const orderNo = order.name || order.order_number || `ORD-${order.id}`;
    const orderDate = order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const customer = order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Online Customer' : 'Retail Customer';
    const payment = order.gateway || (order.payment_gateway_names ? order.payment_gateway_names[0] : 'Online');

    const lineItems = order.line_items && order.line_items.length > 0 ? order.line_items : [{
      title: 'Order Item',
      quantity: 1,
      price: order.total_price || 0,
      sku: '',
    }];

    lineItems.forEach((item: any) => {
      rows.push({
        'Order Number': orderNo,
        'Transaction Date': orderDate,
        'Customer Name': customer,
        'Item Purchased': item.title || item.name || 'Item',
        'SKU': item.sku || '',
        'Quantity Sold': String(item.quantity || 1),
        'Unit Price': String(item.price || '0'),
        'Total Order Revenue': String(Number(item.price || 0) * Number(item.quantity || 1)),
        'Payment Gateway': payment,
      });
    });
  });

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    rowCount: rows.length,
    rawText: JSON.stringify(shopifyOrders, null, 2),
    delimiter: ',',
  };
}

import type { Product, Transaction, ProductReturn } from '@/lib/types';

/**
 * Converts Shopify raw products into AnalyzeUp canonical Product objects.
 */
export function convertShopifyToCanonicalProducts(shopifyProducts: any[]): Product[] {
  const products: Product[] = [];

  shopifyProducts.forEach((p) => {
    const title = p.title || p.name || 'Untitled Product';
    const category = p.product_type || p.category || 'General';
    const vendor = p.vendor || p.supplier || 'Shopify Vendor';

    const variants =
      p.variants && p.variants.length > 0
        ? p.variants
        : [
            {
              id: p.id,
              price: p.price || 0,
              sku: p.sku || `SKU-${p.id}`,
              inventory_quantity: p.inventory_quantity || 0,
            },
          ];

    variants.forEach((v: any) => {
      const price = Number(v.price) || 0;
      const costPrice = Number(v.cost) || Math.round(price * 0.6);
      const stock = Math.max(0, Number(v.inventory_quantity !== undefined ? v.inventory_quantity : 0));
      const sku = String(v.sku || (v.barcode ? v.barcode : `SKU-${p.id}-${v.id || '0'}`));
      const name = variants.length > 1 && v.title ? `${title} (${v.title})` : title;

      products.push({
        id: `shopify_${p.id}_${v.id || 'default'}`,
        name,
        sku,
        category,
        price,
        costPrice,
        stock,
        reorderPoint: Math.max(5, Math.round(stock * 0.2)),
        supplier: vendor,
        source: 'SHOPIFY',
        shopifyProductId: String(p.id),
        shopifyVariantId: v.id ? String(v.id) : undefined,
        compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  });

  return products;
}

/**
 * Converts Shopify raw orders into AnalyzeUp canonical Transaction objects.
 */
export function convertShopifyToCanonicalTransactions(shopifyOrders: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  shopifyOrders.forEach((order) => {
    const orderId = String(order.name || order.order_number || `ORD-${order.id}`);
    const dateStr = order.created_at
      ? order.created_at.split('T')[0]
      : new Date().toISOString().split('T')[0];

    const customer = order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Online Customer'
      : 'Retail Customer';

    const paymentMethod =
      order.gateway ||
      (order.payment_gateway_names && order.payment_gateway_names.length > 0
        ? order.payment_gateway_names[0]
        : 'Shopify Payments');

    const lineItems =
      order.line_items && order.line_items.length > 0
        ? order.line_items
        : [
            {
              id: order.id,
              title: 'Order Item',
              quantity: 1,
              price: order.total_price || 0,
              sku: '',
            },
          ];

    lineItems.forEach((item: any, idx: number) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const unitPrice = Number(item.price || 0);
      const totalRevenue = unitPrice * qty;
      const costPerUnit = Math.round(unitPrice * 0.6);
      const totalCost = costPerUnit * qty;

      transactions.push({
        id: `tx_shopify_${order.id}_${item.id || idx}`,
        productId: String(item.product_id || item.id || `shopify_prod_${idx}`),
        orderNumber: orderId,
        transactionDate: dateStr,
        productName: item.title || item.name || 'Order Item',
        sku: item.sku || '',
        type: 'Sale',
        quantity: qty,
        price: unitPrice,
        unitPrice,
        totalRevenue,
        costPrice: costPerUnit,
        costPerUnit,
        totalCost,
        customerName: customer,
        paymentMethod,
        source: 'SHOPIFY',
        createdAt: dateStr,
        updatedAt: dateStr,
      });
    });
  });

  return transactions;
}

/**
 * Heuristically determines return reason from note, customer comment, reason text, or restock status.
 */
export function determineReturnReason(
  rawText: string = '',
  restockType?: string,
  restockBool?: boolean
): ProductReturn['reason'] {
  const lower = (rawText || '').toLowerCase().trim();

  // 1. Defective detection
  if (
    lower.includes('defect') ||
    lower.includes('broken') ||
    lower.includes('faulty') ||
    lower.includes('malfunction') ||
    lower.includes('not working') ||
    lower.includes('damaged product') ||
    lower.includes('poor quality') ||
    lower.includes('bad quality') ||
    lower.includes('low quality') ||
    lower.includes('quality issue') ||
    lower.includes('torn') ||
    lower.includes('scratched') ||
    lower.includes('leaking') ||
    lower.includes('flaw') ||
    lower.includes('item damaged') ||
    lower.includes('damaged item') ||
    lower.includes('doa') ||
    lower.includes('dead on arrival') ||
    lower === 'defective'
  ) {
    return 'Defective';
  }

  // 2. Damaged in Transit detection
  if (
    lower.includes('transit') ||
    lower.includes('shipping') ||
    lower.includes('carrier') ||
    lower.includes('crushed') ||
    lower.includes('delivery damage') ||
    lower.includes('package damaged') ||
    lower.includes('courier') ||
    lower.includes('shipping damage') ||
    lower.includes('box damaged') ||
    lower.includes('arrived damaged') ||
    lower.includes('damaged during delivery') ||
    lower.includes('damaged in transit') ||
    lower === 'damaged'
  ) {
    return 'Damaged in Transit';
  }

  // 3. Wrong Item detection
  if (
    lower.includes('wrong') ||
    lower.includes('incorrect') ||
    lower.includes('size') ||
    lower.includes('color') ||
    lower.includes('style') ||
    lower.includes('not as described') ||
    lower.includes('fit') ||
    lower.includes('too large') ||
    lower.includes('too small') ||
    lower.includes('different') ||
    lower.includes('mismatch') ||
    lower.includes('not what i ordered') ||
    lower.includes('exchange')
  ) {
    return 'Wrong Item';
  }

  // 4. Buyer Remorse / Unopened / Order Cancellation
  if (
    lower.includes('remorse') ||
    lower.includes('unwanted') ||
    lower.includes('unopened') ||
    lower.includes('cancel') ||
    lower.includes('changed mind') ||
    lower.includes('change of mind') ||
    lower.includes('buyer') ||
    lower.includes('mistake') ||
    lower.includes('no longer needed') ||
    lower.includes('not needed') ||
    lower.includes('accidental') ||
    lower.includes('customer') ||
    lower.includes('not satisfied') ||
    lower.includes('disliked') ||
    lower.includes('dont want') ||
    lower.includes('duplicate') ||
    lower.includes('order cancelled')
  ) {
    return 'Unopened / Buyer Remorse';
  }

  // 5. Restock-based inference:
  // If an item is restocked back to inventory in Shopify, it is resalable, meaning it was not broken or defective.
  // Standard restocked customer returns default to 'Unopened / Buyer Remorse'.
  const rType = (restockType || '').toLowerCase();
  if (rType === 'return' || rType === 'cancel' || rType === 'legacy_restock' || restockBool === true) {
    return 'Unopened / Buyer Remorse';
  }

  // If marked explicitly as no_restock / discarded without note, default to Defective (damaged/non-resalable)
  if (rType === 'no_restock' || rType === 'cancel_no_restock' || restockBool === false) {
    return 'Defective';
  }

  // Fallback for general unclassified Shopify refunds:
  // In retail/e-commerce, standard customer refunds without specific defect reports are buyer returns.
  if (lower.includes('refund') || lower.includes('return') || !lower) {
    return 'Unopened / Buyer Remorse';
  }

  return 'Other';
}

/**
 * Maps Shopify restock_type to canonical actionTaken.
 */
function determineActionTaken(restockType?: string, restockBool?: boolean): ProductReturn['actionTaken'] {
  const typeLower = (restockType || '').toLowerCase();
  if (typeLower === 'no_restock' || typeLower === 'cancel_no_restock' || restockBool === false) {
    return 'Disposed / Written Off';
  }
  if (typeLower === 'return' || typeLower === 'cancel' || typeLower === 'legacy_restock' || restockBool === true) {
    return 'Restocked';
  }
  return 'Restocked';
}

/**
 * Converts Shopify raw orders (with nested refunds/returns) or standalone Shopify refund objects
 * into AnalyzeUp canonical ProductReturn objects.
 */
export function convertShopifyToCanonicalReturns(shopifyOrdersOrRefunds: any[]): ProductReturn[] {
  if (!shopifyOrdersOrRefunds || !Array.isArray(shopifyOrdersOrRefunds) || shopifyOrdersOrRefunds.length === 0) {
    return [];
  }

  const returns: ProductReturn[] = [];
  const processedReturnIds = new Set<string>();

  shopifyOrdersOrRefunds.forEach((entry) => {
    if (!entry) return;

    // Check if entry is a standalone Refund object (e.g. from refunds/create webhook)
    const isStandaloneRefund = Boolean(
      (entry.refund_line_items || entry.transactions) &&
      (entry.order_id || !entry.line_items)
    );

    if (isStandaloneRefund) {
      processRefundObject(entry, null);
      return;
    }

    // Entry is an Order object
    const order = entry;
    const refunds = Array.isArray(order.refunds) ? order.refunds : [];

    refunds.forEach((refund: any) => {
      processRefundObject(refund, order);
    });

    // Also process native Shopify returns if present on the order
    if (Array.isArray(order.returns) && order.returns.length > 0) {
      processNativeReturns(order);
    }

    // Fallback: If an order has financial_status === 'refunded' or 'partially_refunded' or total_refunded > 0,
    // but no refunds array was parsed, record the order-level refund.
    const totalRefundedNum = Number(order.total_refunded || 0);
    const isRefundedStatus = order.financial_status === 'refunded' || order.financial_status === 'partially_refunded';
    if (refunds.length === 0 && (totalRefundedNum > 0 || isRefundedStatus)) {
      const orderId = String(order.id || '');
      const returnId = `ret_shopify_${orderId}_order_refund`;
      if (!processedReturnIds.has(returnId)) {
        processedReturnIds.add(returnId);
        const orderNumber = String(order.name || order.order_number || (orderId ? `#${orderId}` : ''));
        const returnDate = order.updated_at
          ? order.updated_at.split('T')[0]
          : (order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

        const customerName = order.customer
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Online Customer'
          : 'Shopify Customer';

        const firstLineItem = (Array.isArray(order.line_items) && order.line_items.length > 0)
          ? order.line_items[0]
          : {};
        const rawProdId = firstLineItem.product_id
          ? String(firstLineItem.product_id).replace(/^gid:\/\/shopify\/Product\//, '')
          : '';
        const rawVarId = firstLineItem.variant_id
          ? String(firstLineItem.variant_id).replace(/^gid:\/\/shopify\/ProductVariant\//, '')
          : '';
        const prodId = rawProdId
          ? (rawVarId ? `shopify_${rawProdId}_${rawVarId}` : `shopify_${rawProdId}_default`)
          : `shopify_order_${orderId}`;
        const productName = firstLineItem.title || (orderNumber ? `Order ${orderNumber}` : 'Refunded Order');
        const sku = String(firstLineItem.sku || '');
        const refundAmount = totalRefundedNum > 0 ? totalRefundedNum : Number(order.total_price || 0);

        returns.push({
          id: returnId,
          productId: prodId,
          productName,
          sku,
          orderNumber,
          quantity: 1,
          customerName,
          reason: determineReturnReason(order.cancel_reason || order.note || '', 'return', true),
          actionTaken: 'Restocked',
          refundStatus: 'Refunded',
          refundAmount,
          returnDate,
          notes: order.cancel_reason ? `${order.cancel_reason} (Shopify Order Refund)` : `Shopify Refund: ${orderNumber}`,
          source: 'SHOPIFY',
          createdAt: returnDate,
          updatedAt: returnDate,
        });
      }
    }
  });

  function processRefundObject(refund: any, parentOrder: any | null) {
    const refundId = String(refund.id || `ref_${Date.now().toString(36)}`);
    const orderId = String(parentOrder?.id || refund.order_id || '');
    const orderNumber = String(
      parentOrder?.name ||
      parentOrder?.order_number ||
      (orderId ? `#${orderId}` : '')
    );
    const returnDate = refund.created_at
      ? refund.created_at.split('T')[0]
      : (parentOrder?.created_at ? parentOrder.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

    const customerName = parentOrder?.customer
      ? `${parentOrder.customer.first_name || ''} ${parentOrder.customer.last_name || ''}`.trim() || 'Online Customer'
      : (refund.customer
          ? `${refund.customer.first_name || ''} ${refund.customer.last_name || ''}`.trim()
          : 'Shopify Customer');

    const note = refund.note || refund.reason || parentOrder?.cancel_reason || '';
    const defaultReason = determineReturnReason(note, refund.restock ? 'return' : undefined, refund.restock);

    const refundLineItems = Array.isArray(refund.refund_line_items) ? refund.refund_line_items : [];

    if (refundLineItems.length > 0) {
      refundLineItems.forEach((rli: any, idx: number) => {
        const rliId = String(rli.id || idx);
        const returnId = `ret_shopify_${orderId || 'ord'}_${refundId}_${rliId}`;

        if (processedReturnIds.has(returnId)) return;
        processedReturnIds.add(returnId);

        // Match line item from parent order if rli.line_item is incomplete
        const matchingParentItem = parentOrder?.line_items?.find(
          (li: any) => String(li.id) === String(rli.line_item_id)
        );
        const lineItem = rli.line_item || matchingParentItem || {};

        const rawProdId = lineItem.product_id
          ? String(lineItem.product_id).replace(/^gid:\/\/shopify\/Product\//, '')
          : '';
        const rawVarId = lineItem.variant_id
          ? String(lineItem.variant_id).replace(/^gid:\/\/shopify\/ProductVariant\//, '')
          : '';

        const prodId = rawProdId
          ? (rawVarId ? `shopify_${rawProdId}_${rawVarId}` : `shopify_${rawProdId}_default`)
          : String(rli.line_item_id || lineItem.id || `prod_${idx}`);
        const productName = lineItem.title || lineItem.name || matchingParentItem?.title || 'Returned Item';
        const sku = String(lineItem.sku || matchingParentItem?.sku || '');
        const quantity = Math.max(1, Number(rli.quantity || 1));
        const unitPrice = Number(lineItem.price || matchingParentItem?.price || 0);
        const refundAmount = Number(
          rli.subtotal !== undefined && rli.subtotal !== null
            ? rli.subtotal
            : (unitPrice * quantity)
        ) || 0;
        const actionTaken = determineActionTaken(rli.restock_type, refund.restock);
        const itemReason = determineReturnReason(note, rli.restock_type, refund.restock);

        returns.push({
          id: returnId,
          productId: prodId,
          productName,
          sku,
          orderNumber,
          quantity,
          customerName,
          reason: itemReason,
          actionTaken,
          refundStatus: 'Refunded',
          refundAmount,
          returnDate,
          notes: note ? `${note} (Shopify Refund #${refundId})` : `Shopify Refund #${refundId}`,
          source: 'SHOPIFY',
          createdAt: returnDate,
          updatedAt: returnDate,
        });
      });
    } else {
      // Fallback for monetary refund without specific line items (e.g. partial refund, shipping refund)
      const txRefundAmount = (refund.transactions || [])
        .filter((tx: any) => (tx.kind || '').toLowerCase() === 'refund')
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

      const totalAdjustAmount = txRefundAmount > 0
        ? txRefundAmount
        : Number(
            refund.amount ||
            refund.total_refunded ||
            refund.order_adjustments?.[0]?.amount ||
            parentOrder?.total_refunded ||
            0
          );

      if (totalAdjustAmount > 0) {
        const returnId = `ret_shopify_${orderId || 'ord'}_${refundId}_monetary`;
        if (!processedReturnIds.has(returnId)) {
          processedReturnIds.add(returnId);
          returns.push({
            id: returnId,
            productId: orderId ? `shopify_order_${orderId}` : `shopify_ref_${refundId}`,
            productName: orderNumber ? `Shopify Refund: ${orderNumber}` : `Shopify Refund #${refundId}`,
            orderNumber,
            quantity: 1,
            customerName,
            reason: defaultReason,
            actionTaken: 'Disposed / Written Off',
            refundStatus: 'Refunded',
            refundAmount: totalAdjustAmount,
            returnDate,
            notes: note ? `${note} (Monetary refund)` : `Shopify Monetary Refund #${refundId}`,
            source: 'SHOPIFY',
            createdAt: returnDate,
            updatedAt: returnDate,
          });
        }
      }
    }
  }

  function processNativeReturns(order: any) {
    const orderId = String(order.id || '');
    const orderNumber = String(order.name || order.order_number || `#${orderId}`);
    const customerName = order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Online Customer'
      : 'Shopify Customer';

    order.returns.forEach((ret: any) => {
      const retId = String(ret.id || `ret_${Date.now().toString(36)}`);
      const retDate = ret.created_at ? ret.created_at.split('T')[0] : (order.created_at ? order.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
      const returnLineItems = Array.isArray(ret.return_line_items) ? ret.return_line_items : [];

      returnLineItems.forEach((rli: any, idx: number) => {
        const returnItemId = `ret_shopify_native_${orderId}_${retId}_${rli.id || idx}`;
        if (processedReturnIds.has(returnItemId)) return;
        processedReturnIds.add(returnItemId);

        const matchingParentItem = order.line_items?.find(
          (li: any) => String(li.id) === String(rli.line_item_id || rli.fulfillment_line_item?.line_item_id)
        );
        const lineItem = rli.fulfillment_line_item?.line_item || rli.line_item || matchingParentItem || {};
        const reasonFromReturn = determineReturnReason(rli.return_reason || rli.return_reason_note || '');
        const rawProdId = lineItem.product_id
          ? String(lineItem.product_id).replace(/^gid:\/\/shopify\/Product\//, '')
          : '';
        const rawVarId = lineItem.variant_id
          ? String(lineItem.variant_id).replace(/^gid:\/\/shopify\/ProductVariant\//, '')
          : '';
        const prodId = rawProdId
          ? (rawVarId ? `shopify_${rawProdId}_${rawVarId}` : `shopify_${rawProdId}_default`)
          : String(rli.fulfillment_line_item_id || lineItem.id || `prod_${idx}`);
        const productName = lineItem.title || lineItem.name || matchingParentItem?.title || 'Returned Item';
        const qty = Math.max(1, Number(rli.quantity || 1));
        const unitPrice = Number(lineItem.price || matchingParentItem?.price || 0);

        returns.push({
          id: returnItemId,
          productId: prodId,
          productName,
          sku: lineItem.sku || matchingParentItem?.sku || '',
          orderNumber,
          quantity: qty,
          customerName,
          reason: reasonFromReturn,
          actionTaken: 'Restocked',
          refundStatus: ret.status === 'CLOSED' || ret.status === 'REFUNDED' ? 'Refunded' : 'Pending',
          refundAmount: unitPrice * qty,
          returnDate: retDate,
          notes: rli.return_reason_note || `Shopify Return #${retId}`,
          source: 'SHOPIFY',
          createdAt: retDate,
          updatedAt: retDate,
        });
      });
    });
  }

  return returns;
}

/**
 * Helper to extract numeric ID from Shopify Global ID (gid://shopify/Type/12345) or raw ID.
 */
export function extractShopifyNumericId(gidOrId: string | number | undefined | null): string {
  if (!gidOrId) return '';
  const str = String(gidOrId).trim();
  const match = str.match(/\/([^\/?#]+)$/);
  return match ? match[1] : str;
}

/**
 * Converts Shopify GraphQL Return objects (from returns query utilizing read_returns scope)
 * into AnalyzeUp canonical ProductReturn objects.
 */
export function convertShopifyGraphQLReturnsToCanonical(graphqlReturns: any[]): ProductReturn[] {
  if (!graphqlReturns || !Array.isArray(graphqlReturns) || graphqlReturns.length === 0) {
    return [];
  }

  const returns: ProductReturn[] = [];
  const processedReturnIds = new Set<string>();

  graphqlReturns.forEach((node) => {
    if (!node) return;

    const returnId = extractShopifyNumericId(node.id) || `ret_${Date.now().toString(36)}`;
    const returnName = String(node.name || '');
    const returnDate = node.createdAt
      ? node.createdAt.split('T')[0]
      : new Date().toISOString().split('T')[0];

    const order = node.order || {};
    const orderNumber = String(order.name || '');
    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Online Customer'
      : 'Shopify Customer';

    // Support both nodes array and edges array
    let rawItems: any[] = [];
    if (Array.isArray(node.returnLineItems?.nodes)) {
      rawItems = node.returnLineItems.nodes;
    } else if (Array.isArray(node.returnLineItems?.edges)) {
      rawItems = node.returnLineItems.edges.map((e: any) => e.node);
    } else if (Array.isArray(node.returnLineItems)) {
      rawItems = node.returnLineItems;
    }

    if (rawItems.length === 0) {
      const canonicalId = `ret_shopify_gql_${returnId}`;
      if (!processedReturnIds.has(canonicalId)) {
        processedReturnIds.add(canonicalId);
        returns.push({
          id: canonicalId,
          productId: `shopify_return_${returnId}`,
          productName: returnName ? `Shopify Return ${returnName}` : 'Shopify Return',
          sku: '',
          orderNumber,
          quantity: Math.max(1, Number(node.totalQuantity || 1)),
          customerName,
          reason: 'Other',
          actionTaken: 'Restocked',
          refundStatus: node.status === 'CLOSED' ? 'Refunded' : 'Pending',
          refundAmount: 0,
          returnDate,
          notes: `Shopify Return ${returnName || returnId}`,
          source: 'SHOPIFY',
          createdAt: returnDate,
          updatedAt: returnDate,
        });
      }
      return;
    }

    rawItems.forEach((rli: any, idx: number) => {
      const rliId = extractShopifyNumericId(rli.id) || String(idx);
      const canonicalId = `ret_shopify_gql_${returnId}_${rliId}`;

      if (processedReturnIds.has(canonicalId)) return;
      processedReturnIds.add(canonicalId);

      const fulfillmentLineItem = rli.fulfillmentLineItem || {};
      const lineItem = fulfillmentLineItem.lineItem || rli.lineItem || {};
      const product = lineItem.product || {};
      const variant = lineItem.variant || {};

      const rawProdId = extractShopifyNumericId(product.id);
      const rawVarId = extractShopifyNumericId(variant.id);
      const prodId = rawProdId
        ? (rawVarId ? `shopify_${rawProdId}_${rawVarId}` : `shopify_${rawProdId}_default`)
        : `shopify_return_item_${rliId}`;

      const productName = lineItem.title || product.title || 'Returned Product';
      const sku = String(lineItem.sku || '');
      const quantity = Math.max(1, Number(rli.quantity || 1));
      const unitPrice = Number(lineItem.originalUnitPriceSet?.shopMoney?.amount || lineItem.price || 0);
      const refundAmount = unitPrice * quantity;

      const reasonCode = (rli.returnReason || '').toUpperCase().trim();
      const reasonNote = String(rli.returnReasonNote || '');
      let reason: ProductReturn['reason'] = 'Other';

      if (reasonCode === 'DEFECTIVE') {
        reason = 'Defective';
      } else if (reasonCode === 'DAMAGED') {
        reason = 'Damaged in Transit';
      } else if (['SIZE_TOO_SMALL', 'SIZE_TOO_LARGE', 'STYLE', 'COLOR', 'NOT_AS_DESCRIBED', 'WRONG_ITEM'].includes(reasonCode)) {
        reason = 'Wrong Item';
      } else if (['UNWANTED', 'ACCIDENTAL_ORDER'].includes(reasonCode)) {
        reason = 'Unopened / Buyer Remorse';
      } else {
        reason = determineReturnReason(`${reasonCode} ${reasonNote}`, 'return', true);
      }

      const actionTaken = (reason === 'Defective' || reason === 'Damaged in Transit')
        ? 'Disposed / Written Off'
        : 'Restocked';

      returns.push({
        id: canonicalId,
        productId: prodId,
        productName,
        sku,
        orderNumber,
        quantity,
        customerName,
        reason,
        actionTaken,
        refundStatus: node.status === 'CLOSED' ? 'Refunded' : 'Pending',
        refundAmount,
        returnDate,
        notes: reasonNote ? `${reasonNote} (Shopify Return ${returnName})` : `Shopify Return ${returnName || returnId}`,
        source: 'SHOPIFY',
        createdAt: returnDate,
        updatedAt: returnDate,
      });
    });
  });

  return returns;
}

/**
 * Merges and deduplicates returns from GraphQL returns and REST order refunds.
 */
export function mergeAndDeduplicateReturns(
  orderReturns: ProductReturn[],
  graphQLReturns: ProductReturn[]
): ProductReturn[] {
  const merged: ProductReturn[] = [];
  const seenKeys = new Set<string>();

  // Prioritize GraphQL returns (contain native Return status and reason codes)
  for (const r of graphQLReturns) {
    const key = r.orderNumber && r.sku ? `${r.orderNumber}_${r.sku}` : r.id;
    if (!seenKeys.has(key) && !seenKeys.has(r.id)) {
      seenKeys.add(key);
      seenKeys.add(r.id);
      merged.push(r);
    }
  }

  // Then include REST order refunds if not already covered
  for (const r of orderReturns) {
    const key = r.orderNumber && r.sku ? `${r.orderNumber}_${r.sku}` : r.id;
    if (!seenKeys.has(key) && !seenKeys.has(r.id)) {
      seenKeys.add(key);
      seenKeys.add(r.id);
      merged.push(r);
    }
  }

  return merged;
}

