import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { getShopifyClientSecret, sanitizeShopDomain } from '@/lib/shopify/config';
import { POST as handleWebhook } from '../route';

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveServerTenant(req);
    let tenantId = tenant?.tenantId || '';

    const body = await req.json().catch(() => ({}));
    if (!tenantId && body.userId) {
      tenantId = String(body.userId);
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to simulate Shopify webhooks.' },
        { status: 401 }
      );
    }

    const db = getAdminFirestore();
    let shop = sanitizeShopDomain(body.shop || '');

    // Auto-resolve connected store domain if not provided
    if (!shop && db) {
      const profileSnap = await db.collection('users').doc(tenantId).collection('settings').doc('business_profile').get();
      if (profileSnap.exists) {
        shop = sanitizeShopDomain(profileSnap.data()?.shopifyStoreUrl || '');
      }

      if (!shop) {
        const intSnap = await db.collection('users').doc(tenantId).collection('integrations').doc('shopify').get();
        if (intSnap.exists) {
          shop = sanitizeShopDomain(intSnap.data()?.shopDomain || '');
        }
      }
    }

    if (!shop) {
      shop = 'demo-store.myshopify.com';
    }

    // Ensure shop_stores mapping exists so webhook handler can route to this tenant
    if (db && tenantId) {
      await db.collection('shopify_stores').doc(shop).set({
        shopDomain: shop,
        tenantId,
        userId: tenantId,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(console.warn);
    }

    const eventType = body.eventType || 'orders/create';
    const orderId = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const orderNum = `#SIM-${Math.floor(1000 + Math.random() * 9000)}`;

    // Try to find an existing product to simulate against for maximum realism
    let chosenProduct: any = null;
    if (db && tenantId) {
      try {
        const prodsSnap = await db.collection('users').doc(tenantId).collection('products').limit(5).get();
        if (!prodsSnap.empty) {
          chosenProduct = prodsSnap.docs[0].data();
        }
      } catch {}
    }

    const unitPrice = chosenProduct?.price || 1499;
    const quantity = 1;
    const prodTitle = chosenProduct?.name || 'Pro Running Sneakers';
    const prodSku = chosenProduct?.sku || `SKU-SIM-${orderId.slice(-4)}`;
    const prodShopifyId = chosenProduct?.shopifyProductId || '789123456';
    const varShopifyId = chosenProduct?.shopifyVariantId || '987654321';

    let payload: any = {};

    if (eventType === 'orders/create') {
      payload = {
        id: orderId,
        name: orderNum,
        currency: 'INR',
        total_price: String(unitPrice * quantity),
        subtotal_price: String(unitPrice * quantity),
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        customer: {
          first_name: 'Priya',
          last_name: 'Sharma',
          email: 'priya.sharma@example.com',
        },
        line_items: [
          {
            id: String(Date.now()),
            product_id: prodShopifyId,
            variant_id: varShopifyId,
            title: prodTitle,
            sku: prodSku,
            price: String(unitPrice),
            quantity,
          },
        ],
      };
    } else if (eventType === 'inventory_levels/update') {
      payload = {
        inventory_item_id: chosenProduct?.shopifyInventoryItemId || 'inv_sim_123',
        location_id: 'loc_sim_main',
        available: Math.max(0, (chosenProduct?.stock ?? 25) - 2),
      };
    } else {
      payload = {
        id: orderId,
        name: orderNum,
        created_at: new Date().toISOString(),
      };
    }

    const rawBody = JSON.stringify(payload);
    const clientSecret = getShopifyClientSecret();
    const hmac = crypto
      .createHmac('sha256', clientSecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    // Create synthetic request to real webhook POST handler
    const headers = new Headers({
      'content-type': 'application/json',
      'x-shopify-topic': eventType,
      'x-shopify-shop-domain': shop,
      'x-shopify-hmac-sha256': hmac,
      'x-shopify-webhook-id': `wh_sim_${Date.now()}`,
    });

    const syntheticReq = new NextRequest(new URL('/api/shopify/webhooks', req.url), {
      method: 'POST',
      headers,
      body: rawBody,
    });

    const webhookRes = await handleWebhook(syntheticReq);
    const webhookData = await webhookRes.json().catch(() => ({}));

    if (!webhookRes.ok) {
      return NextResponse.json({
        success: false,
        error: webhookData.error || 'Webhook execution failed',
      }, { status: webhookRes.status });
    }

    return NextResponse.json({
      success: true,
      simulated: true,
      topic: eventType,
      shop,
      orderNumber: orderNum,
      productName: prodTitle,
      totalAmount: unitPrice * quantity,
      message: `Simulated Shopify event "${eventType}" processed and reflected immediately in your dashboard.`,
      webhookResult: webhookData,
    });
  } catch (error: any) {
    console.error('[Shopify Simulate Webhook Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to simulate webhook.' },
      { status: 500 }
    );
  }
}
