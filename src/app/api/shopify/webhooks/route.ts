import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { verifyWebhookHmac } from '@/lib/shopify/crypto';
import { getShopifyClientSecret, sanitizeShopDomain } from '@/lib/shopify/config';
import { getShopifyConnection, markShopifyUninstalled } from '@/lib/shopify/connection-store';
import { checkIsOutgoingOperation } from '@/lib/shopify/loop-prevention';

declare global {
  var __shopifyProcessedWebhooks: Set<string> | undefined;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const topic = (req.headers.get('x-shopify-topic') || '').toLowerCase();
    const rawShop = req.headers.get('x-shopify-shop-domain') || '';
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const webhookId = req.headers.get('x-shopify-webhook-id') || `wh_${Date.now()}`;

    const shop = sanitizeShopDomain(rawShop);
    if (!shop) {
      return NextResponse.json({ error: 'Invalid or missing shop domain in webhook headers' }, { status: 400 });
    }

    // 1. Verify HMAC authenticity using SHOPIFY_CLIENT_SECRET
    const clientSecret = getShopifyClientSecret();
    const isAuthentic = verifyWebhookHmac(rawBody, hmacHeader, clientSecret);
    if (!isAuthentic) {
      console.warn(`[Shopify Webhook] Rejected unauthorized HMAC signature from ${shop}, topic: ${topic}`);
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const db = getAdminFirestore();

    // 2. Webhook Idempotency Check (shop + webhookId)
    const idempotencyDocId = `${shop}_${webhookId}`;
    if (!globalThis.__shopifyProcessedWebhooks) {
      globalThis.__shopifyProcessedWebhooks = new Set<string>();
    }

    if (globalThis.__shopifyProcessedWebhooks.has(idempotencyDocId)) {
      return NextResponse.json({ received: true, deduplicated: true }, { status: 200 });
    }

    if (db) {
      try {
        const idempotencyRef = db.collection('shopify_processed_webhooks').doc(idempotencyDocId);
        const idempotencySnap = await idempotencyRef.get();
        if (idempotencySnap.exists) {
          globalThis.__shopifyProcessedWebhooks.add(idempotencyDocId);
          return NextResponse.json({ received: true, deduplicated: true }, { status: 200 });
        }

        await idempotencyRef.set({
          shop,
          webhookId,
          topic,
          processedAt: new Date().toISOString(),
          status: 'PROCESSED',
        }).catch(() => {});
      } catch (err: any) {
        console.warn('[Shopify Webhooks] Firestore idempotency notice:', err?.message || err);
      }
    }

    globalThis.__shopifyProcessedWebhooks.add(idempotencyDocId);

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    // 3. Resolve tenant ID associated with this store
    const connection = await getShopifyConnection(shop);
    if (!connection) {
      console.warn(`[Shopify Webhook] Received webhook for unmapped shop: ${shop}`);
      return NextResponse.json({ received: true, status: 'unmapped_shop' }, { status: 200 });
    }

    const tenantId = connection.tenantId;

    // 4. Handle App Uninstallation Webhook
    if (topic === 'app/uninstalled') {
      console.log(`[Shopify Webhook] Merchant ${shop} uninstalled AnalyzeUp. Scrubbing credentials...`);
      await markShopifyUninstalled(shop);
      return NextResponse.json({ received: true, status: 'uninstalled' }, { status: 200 });
    }

    // If store is already marked uninstalled, drop event
    if (connection.status === 'UNINSTALLED') {
      return NextResponse.json({ received: true, status: 'store_uninstalled' }, { status: 200 });
    }

    // 5. Loop Prevention Check
    const resourceId = String(payload.id || payload.inventory_item_id || payload.order_id || '');
    const loopCheck = await checkIsOutgoingOperation(shop, resourceId);

    const batch = db.batch();

    // -------------------------------------------------------------
    // HANDLER: Orders (orders/create, orders/updated, orders/paid)
    // -------------------------------------------------------------
    if (topic.startsWith('orders/')) {
      const orderId = String(payload.id || '');
      const orderNumber = payload.name || `#${orderId}`;
      const customerName = payload.customer
        ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim() || 'Customer'
        : 'Shopify Customer';
      const totalPrice = Number(payload.total_price || 0);

      // Save Sales Order
      const salesOrderRef = db.collection('users').doc(tenantId).collection('sales_orders').doc(`order_${orderId}`);
      batch.set(salesOrderRef, {
        id: `order_${orderId}`,
        shopifyOrderId: orderId,
        orderNumber,
        tenantId,
        customerName,
        customerEmail: payload.customer?.email || null,
        financialStatus: payload.financial_status || 'PAID',
        fulfillmentStatus: payload.fulfillment_status || 'UNFULFILLED',
        currency: payload.currency || 'USD',
        subtotalPrice: Number(payload.subtotal_price || 0),
        totalDiscounts: Number(payload.total_discounts || 0),
        totalTax: Number(payload.total_tax || 0),
        totalPrice,
        lineItemsCount: payload.line_items?.length || 0,
        processedAt: payload.processed_at || payload.created_at,
        source: 'SHOPIFY',
        createdAt: payload.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Save Line Item Transactions
      for (const li of payload.line_items || []) {
        const lineItemId = String(li.id || '');
        const unitPrice = Number(li.price || 0);
        const qty = Number(li.quantity || 1);
        const txDocId = `tx_shopify_${orderId}_${lineItemId}`;
        const txRef = db.collection('users').doc(tenantId).collection('transactions').doc(txDocId);

        batch.set(txRef, {
          id: txDocId,
          tenantId,
          userId: tenantId,
          orderNumber,
          shopifyOrderId: orderId,
          productId: li.variant_id ? `shopify_${li.product_id}_${li.variant_id}` : `shopify_${li.product_id}`,
          productName: li.title || 'Product',
          sku: li.sku || 'N/A',
          type: 'Sale',
          quantity: qty,
          unitPrice,
          price: unitPrice,
          totalRevenue: unitPrice * qty,
          costPrice: Math.round(unitPrice * 0.6),
          totalCost: Math.round(unitPrice * 0.6 * qty),
          customerName,
          transactionDate: (payload.processed_at || payload.created_at || new Date().toISOString()).split('T')[0],
          source: 'SHOPIFY',
          createdAt: payload.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      // Process any refunds included in the order payload
      if (Array.isArray(payload.refunds) && payload.refunds.length > 0) {
        for (const ref of payload.refunds) {
          const refundId = String(ref.id || '');
          const refundAmount = (ref.transactions || [])
            .filter((t: any) => t.kind === 'refund' && t.status === 'success')
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || Number(ref.total_refunded || 0);

          const refundDocId = `ref_${orderId}_${refundId}`;
          const refundRef = db.collection('users').doc(tenantId).collection('refunds').doc(refundDocId);

          batch.set(refundRef, {
            id: refundDocId,
            shopifyRefundId: refundId,
            shopifyOrderId: orderId,
            orderNumber,
            tenantId,
            amount: refundAmount,
            currency: payload.currency || 'USD',
            createdAt: ref.created_at || new Date().toISOString(),
            processedAt: ref.processed_at || ref.created_at || new Date().toISOString(),
            note: ref.note || null,
            refundLineItems: (ref.refund_line_items || []).map((rli: any) => ({
              id: String(rli.id),
              quantity: rli.quantity,
              subtotal: Number(rli.subtotal || 0),
              title: rli.line_item?.title || 'Refunded Item',
              sku: rli.line_item?.sku || '',
            })),
            source: 'SHOPIFY',
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          // Negative sale adjustment in financial ledger
          const txRefundDocId = `tx_refund_${orderId}_${refundId}`;
          const txRefundRef = db.collection('users').doc(tenantId).collection('transactions').doc(txRefundDocId);
          batch.set(txRefundRef, {
            id: txRefundDocId,
            tenantId,
            userId: tenantId,
            orderNumber,
            shopifyOrderId: orderId,
            productName: `Refund: ${orderNumber}`,
            type: 'Sale',
            quantity: 0,
            price: 0,
            totalRevenue: -Math.abs(refundAmount),
            totalCost: 0,
            customerName,
            transactionDate: (ref.created_at || new Date().toISOString()).split('T')[0],
            source: 'SHOPIFY',
            status: 'Refunded',
            createdAt: ref.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    // -------------------------------------------------------------
    // HANDLER: Standalone Refunds (refunds/create)
    // -------------------------------------------------------------
    if (topic === 'refunds/create') {
      const orderId = String(payload.order_id || '');
      const refundId = String(payload.id || '');
      const refundAmount = (payload.transactions || [])
        .filter((t: any) => t.kind === 'refund')
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || Number(payload.amount || 0);

      const refundDocId = `ref_${orderId}_${refundId}`;
      const refundRef = db.collection('users').doc(tenantId).collection('refunds').doc(refundDocId);

      batch.set(refundRef, {
        id: refundDocId,
        shopifyRefundId: refundId,
        shopifyOrderId: orderId,
        orderNumber: `#${orderId}`,
        tenantId,
        amount: refundAmount,
        currency: payload.currency || 'USD',
        createdAt: payload.created_at || new Date().toISOString(),
        processedAt: payload.processed_at || payload.created_at || new Date().toISOString(),
        note: payload.note || null,
        refundLineItems: (payload.refund_line_items || []).map((rli: any) => ({
          id: String(rli.id),
          quantity: rli.quantity,
          subtotal: Number(rli.subtotal || 0),
          title: rli.line_item?.title || 'Refunded Item',
          sku: rli.line_item?.sku || '',
        })),
        source: 'SHOPIFY',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      const txRefundDocId = `tx_refund_${orderId}_${refundId}`;
      const txRefundRef = db.collection('users').doc(tenantId).collection('transactions').doc(txRefundDocId);
      batch.set(txRefundRef, {
        id: txRefundDocId,
        tenantId,
        userId: tenantId,
        orderNumber: `#${orderId}`,
        shopifyOrderId: orderId,
        productName: `Refund #${refundId}`,
        type: 'Sale',
        quantity: 0,
        price: 0,
        totalRevenue: -Math.abs(refundAmount),
        totalCost: 0,
        customerName: 'Shopify Customer',
        transactionDate: (payload.created_at || new Date().toISOString()).split('T')[0],
        source: 'SHOPIFY',
        status: 'Refunded',
        createdAt: payload.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // -------------------------------------------------------------
    // HANDLER: Products Lifecycle (products/create, products/update, products/delete)
    // -------------------------------------------------------------
    if (topic === 'products/create' || topic === 'products/update') {
      const prodId = String(payload.id || '');
      const title = payload.title || 'Untitled Product';
      const category = payload.product_type || 'General';
      const vendor = payload.vendor || 'Shopify Vendor';
      const variants = Array.isArray(payload.variants) && payload.variants.length > 0
        ? payload.variants
        : [{ id: prodId, price: 0, inventory_quantity: 0, sku: `SKU-${prodId}` }];

      const activeVariantIds = new Set<string>();

      for (const v of variants) {
        const varId = String(v.id || prodId);
        activeVariantIds.add(varId);
        const docId = `shopify_${prodId}_${varId}`;
        const prodRef = db.collection('users').doc(tenantId).collection('products').doc(docId);
        const variantName = variants.length > 1 && v.title && v.title !== 'Default Title'
          ? `${title} (${v.title})`
          : title;
        const price = Number(v.price) || 0;
        const costPrice = Number(v.cost) || Math.round(price * 0.6);
        const stock = Math.max(0, Number(v.inventory_quantity !== undefined ? v.inventory_quantity : 0));

        batch.set(prodRef, {
          id: docId,
          name: variantName,
          sku: String(v.sku || `SKU-${prodId}-${varId}`),
          category,
          price,
          costPrice,
          stock,
          supplier: vendor,
          source: 'SHOPIFY',
          shopifyProductId: prodId,
          shopifyVariantId: varId,
          shopifyInventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : null,
          ...(v.compare_at_price ? { compareAtPrice: Number(v.compare_at_price) } : {}),
          userId: tenantId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      // If updating a product, prune any variants that were removed in Shopify
      if (topic === 'products/update' && prodId) {
        try {
          const existingVarsSnap = await db.collection('users').doc(tenantId).collection('products')
            .where('shopifyProductId', '==', prodId)
            .get();

          for (const d of existingVarsSnap.docs) {
            const data = d.data();
            if (data.shopifyVariantId && !activeVariantIds.has(String(data.shopifyVariantId))) {
              batch.delete(d.ref);
            }
          }
        } catch (pruneErr) {
          console.warn('[Shopify Webhook] Notice checking removed variants:', pruneErr);
        }
      }
    }

    if (topic === 'products/delete') {
      const prodId = String(payload.id || '');
      if (prodId) {
        try {
          const prodsSnap = await db.collection('users').doc(tenantId).collection('products')
            .where('shopifyProductId', '==', prodId)
            .get();

          for (const d of prodsSnap.docs) {
            batch.delete(d.ref);
          }
        } catch (delErr) {
          console.warn('[Shopify Webhook] Notice deleting product variants:', delErr);
        }
      }
    }

    // -------------------------------------------------------------
    // HANDLER: Inventory Updates (inventory_levels/update)
    // -------------------------------------------------------------
    if (topic === 'inventory_levels/update') {
      const invItemId = String(payload.inventory_item_id || '');
      const locId = String(payload.location_id || '');
      const availableQty = Number(payload.available || 0);

      const invDocId = `${invItemId}_${locId}`;
      const invRef = db.collection('users').doc(tenantId).collection('inventory').doc(invDocId);

      batch.set(invRef, {
        id: invDocId,
        tenantId,
        inventoryItemId: invItemId,
        locationId: locId,
        availableQuantity: availableQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Synchronize available stock directly to matched product catalog item
      if (invItemId) {
        try {
          const matchSnap = await db.collection('users').doc(tenantId).collection('products')
            .where('shopifyInventoryItemId', '==', invItemId)
            .get();
          for (const d of matchSnap.docs) {
            batch.update(d.ref, {
              stock: Math.max(0, availableQty),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (invMatchErr) {
          console.warn('[Shopify Webhook] Notice syncing inventory item to product:', invMatchErr);
        }
      }
    }

    // -------------------------------------------------------------
    // HANDLER: Returns Lifecycle (returns/request, returns/update, etc.)
    // -------------------------------------------------------------
    if (topic.startsWith('returns/')) {
      const returnId = String(payload.id || '');
      const orderId = String(payload.order_id || payload.order?.id || '');
      const returnDocId = `ret_${orderId}_${returnId}`;
      const subAction = topic.replace('returns/', '').toUpperCase();

      const returnRef = db.collection('users').doc(tenantId).collection('returns').doc(returnDocId);
      batch.set(returnRef, {
        id: returnDocId,
        shopifyReturnId: returnId,
        shopifyOrderId: orderId,
        orderNumber: payload.order?.name || `#${orderId}`,
        tenantId,
        status: subAction === 'CLOSE' ? 'CLOSED' : subAction === 'APPROVE' ? 'APPROVED' : subAction === 'CANCEL' ? 'CANCELLED' : 'REQUESTED',
        customerName: payload.order?.customer
          ? `${payload.order.customer.first_name || ''} ${payload.order.customer.last_name || ''}`.trim() || 'Customer'
          : 'Shopify Customer',
        returnDate: (payload.created_at || new Date().toISOString()).split('T')[0],
        returnItems: (payload.return_line_items || []).map((rli: any) => ({
          id: String(rli.id || ''),
          lineItemId: String(rli.fulfillment_line_item?.line_item?.id || rli.line_item_id || ''),
          productId: String(rli.fulfillment_line_item?.line_item?.product_id || ''),
          variantId: String(rli.fulfillment_line_item?.line_item?.variant_id || ''),
          sku: String(rli.fulfillment_line_item?.line_item?.sku || ''),
          title: String(rli.fulfillment_line_item?.line_item?.title || 'Returned Item'),
          quantity: Number(rli.quantity || 1),
          unitPrice: Number(rli.fulfillment_line_item?.line_item?.price || 0),
          returnReason: rli.return_reason || null,
          returnReasonNote: rli.return_reason_note || null,
        })),
        source: 'SHOPIFY',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    await batch.commit();

    return NextResponse.json({
      received: true,
      processed: true,
      topic,
      shop,
      isOriginatingFromAnalyzeUp: loopCheck.isOriginatingFromAnalyzeUp,
    }, { status: 200 });
  } catch (err: any) {
    console.error('[Shopify Webhook Handler Error]:', err);
    return NextResponse.json({ error: err?.message || 'Webhook processing failed' }, { status: 500 });
  }
}
