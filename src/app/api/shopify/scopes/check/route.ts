import { NextRequest, NextResponse } from 'next/server';
import { sanitizeShopDomain, getShopifyScopes, getMissingCoreScopes, hasCoreShopifyScopes } from '@/lib/shopify/config';
import { getValidAccessToken, getShopifyGrantedScopes } from '@/lib/shopify/admin-api';
import { getShopifyConnection, saveShopifyConnection } from '@/lib/shopify/connection-store';

/**
 * POST /api/shopify/scopes/check
 * Inspects granted access scopes for an active installation against the 5 required scopes (Phase 4 & 5).
 * Dynamically detects missing scopes (e.g. read_locations, write_inventory) and updates connection record status.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { shop: rawShop, accessToken } = body;

    if (!rawShop) {
      return NextResponse.json(
        { success: false, error: 'Shop domain is required.' },
        { status: 400 }
      );
    }

    const shop = sanitizeShopDomain(rawShop);
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Invalid Shopify store domain.' },
        { status: 400 }
      );
    }

    // Resolve access token (prioritizing server-managed connection with token refresh)
    let token = '';
    try {
      token = await getValidAccessToken(shop);
    } catch (err: any) {
      if (accessToken && String(accessToken).trim()) {
        token = String(accessToken).trim();
      } else {
        return NextResponse.json(
          { success: false, error: `Could not resolve Shopify access token for ${shop}: ${err?.message || err}` },
          { status: 401 }
        );
      }
    }

    // Dynamic scope inspection using Shopify GraphQL / REST Admin API
    const scopeCheck = await getShopifyGrantedScopes(shop);
    const requiredScopes = scopeCheck.requiredScopes;
    let grantedScopes = scopeCheck.grantedScopes;

    // Fallback inspection via REST oauth/access_scopes.json if GraphQL had empty scopes
    if (!grantedScopes || grantedScopes.length === 0) {
      try {
        const res = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = await res.json();
          grantedScopes = (data.access_scopes || []).map((s: any) => s.handle);
        }
      } catch (restErr) {
        console.warn(`[Shopify Scopes Check] REST endpoint notice for ${shop}:`, restErr);
      }
    }

    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const missingCoreScopes = getMissingCoreScopes(grantedScopes);
    const hasCore = missingCoreScopes.length === 0;
    const isAuthorized = missingScopes.length === 0;

    // Update connection status in Firestore/store if installation was previously active
    const conn = await getShopifyConnection(shop);
    if (conn) {
      const updatedStatus = hasCore ? (conn.status === 'PARTIAL' ? 'ACTIVE' : conn.status) : 'PARTIAL';
      if (conn.status !== updatedStatus || JSON.stringify(conn.missingScopes) !== JSON.stringify(missingScopes)) {
        await saveShopifyConnection({
          ...conn,
          grantedScopes,
          missingScopes,
          status: updatedStatus,
          updatedAt: new Date().toISOString(),
        }).catch((e) => console.warn('[Shopify Scopes Check] Connection update note:', e));
      }
    }

    const hasReadProducts = grantedScopes.includes('read_products');
    const hasReadOrders = grantedScopes.includes('read_orders') || grantedScopes.includes('read_all_orders');
    const hasReadInventory = grantedScopes.includes('read_inventory');
    const hasReadLocations = grantedScopes.includes('read_locations');
    const hasWriteInventory = grantedScopes.includes('write_inventory');
    const hasWriteProducts = grantedScopes.includes('write_products');

    return NextResponse.json({
      success: true,
      shop,
      requiredScopes,
      grantedScopes,
      missingScopes,
      isAuthorized,
      hasCoreScopes: hasCore,
      missingCoreScopes,
      status: conn?.status || (hasCore ? 'ACTIVE' : 'PARTIAL'),
      permissions: {
        hasReadProducts,
        hasReadOrders,
        hasReadInventory,
        hasReadLocations,
        hasWriteInventory,
        hasWriteProducts,
      },
    });
  } catch (err: any) {
    console.error('[Shopify Scope Check Error]:', err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to inspect Shopify scopes.',
    }, { status: 500 });
  }
}
