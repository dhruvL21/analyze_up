import { NextRequest, NextResponse } from 'next/server';
import { updateShopifyVariantPrice } from '@/lib/shopify-price-sync';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { getValidAccessToken } from '@/lib/shopify/admin-api';
import { getShopifyConnectionByTenant } from '@/lib/shopify/connection-store';
import { getAdminFirestore, hasAdminCredentials } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveServerTenant(req).catch(() => null);
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const {
      productId,
      shopifyProductId,
      shopifyVariantId,
      sku,
      productName,
      newPrice,
      oldPrice,
      compareAtPrice,
    } = body;

    const tenantId = tenant?.tenantId || body?.userId || body?.tenantId;
    let shop = body?.shop;

    if (!shop && tenantId) {
      const conn = await getShopifyConnectionByTenant(tenantId);
      shop = conn?.shopDomain;
    }

    let accessToken = body?.accessToken;
    if (!accessToken && shop) {
      try {
        accessToken = await getValidAccessToken(shop);
      } catch (tokErr: any) {
        console.warn('[Shopify Price Update] Could not resolve token for shop:', shop, tokErr?.message);
      }
    }

    if (newPrice === undefined || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
      return NextResponse.json(
        { success: false, error: 'A valid non-negative newPrice is required.' },
        { status: 400 }
      );
    }

    // 1. Update in Firestore actual database
    let firestoreUpdated = false;
    if (tenantId && productId && hasAdminCredentials()) {
      try {
        const db = getAdminFirestore();
        if (db) {
          const prodRef = db.collection('users').doc(tenantId).collection('products').doc(productId);
          const finalCompareAt = compareAtPrice !== undefined && Number(compareAtPrice) > Number(newPrice)
            ? Number(compareAtPrice)
            : oldPrice !== undefined && Number(oldPrice) > Number(newPrice)
            ? Number(oldPrice)
            : null;
          const discountPct = finalCompareAt ? Math.round(((finalCompareAt - Number(newPrice)) / finalCompareAt) * 100) : undefined;

          await prodRef.set(
            {
              price: Number(newPrice),
              ...(finalCompareAt !== null ? { compareAtPrice: finalCompareAt } : {}),
              ...(discountPct !== undefined ? { discountPercent: discountPct } : {}),
              liquidationStatus: 'Liquidated',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          firestoreUpdated = true;
        }
      } catch (dbErr) {
        console.warn('[Shopify Price Update] Firestore write notice:', dbErr);
      }
    }

    // 2. Synchronize price to Shopify Admin REST API
    let shopifyResult: any = { success: false, skipped: true };
    if (shop && accessToken) {
      shopifyResult = await updateShopifyVariantPrice({
        shop,
        accessToken,
        productId,
        shopifyProductId,
        shopifyVariantId,
        sku,
        productName,
        newPrice: Number(newPrice),
        oldPrice: oldPrice !== undefined ? Number(oldPrice) : undefined,
        compareAtPrice: compareAtPrice !== undefined ? Number(compareAtPrice) : undefined,
      });
    }

    if (shopifyResult && !shopifyResult.success && !shopifyResult.skipped) {
      if (shopifyResult.status === 403) {
        return NextResponse.json(
          {
            success: true,
            firestoreUpdated,
            shopifyResult,
            warning: 'Price updated in database, but Shopify requires re-authorization for write_products.',
            scopeMissing: 'write_products',
            reinstallRequired: true,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      firestoreUpdated,
      shopifyResult,
      newPrice: Number(newPrice),
      oldPrice: oldPrice !== undefined ? Number(oldPrice) : undefined,
      message: shopifyResult.success
        ? 'Price updated successfully in both workspace database and Shopify store.'
        : 'Price updated successfully in workspace database.',
    });
  } catch (err: any) {
    console.error('[Shopify Price Update Route Error]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unexpected server error updating price.' },
      { status: 500 }
    );
  }
}
