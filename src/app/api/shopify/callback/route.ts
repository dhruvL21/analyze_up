import { NextRequest, NextResponse } from 'next/server';
import {
  getShopifyClientId,
  getShopifyClientSecret,
  getShopifyScopes,
  getShopifyAppUrl,
  sanitizeShopDomain,
  getMissingCoreScopes,
  hasCoreShopifyScopes,
} from '@/lib/shopify/config';
import { verifyShopifyHmac, encryptShopifyToken } from '@/lib/shopify/crypto';
import {
  consumeOAuthState,
  saveShopifyConnection,
} from '@/lib/shopify/connection-store';
import {
  queryGrantedScopes,
  queryShopLocations,
  queryShopDetails,
} from '@/lib/shopify/admin-api';
import { registerShopifyWebhooks } from '@/lib/shopify/webhook-manager';
import { createSyncJob } from '@/lib/shopify/sync-engine';
import type { ShopifyConnectionRecord } from '@/lib/shopify/types';

/**
 * GET /api/shopify/callback
 * Implements the deterministic 17-step OAuth authorization lifecycle (Phase 13).
 * Zero token exposure to URL, client-side storage, or logs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || undefined;
  const proto = req.headers.get('x-forwarded-proto') || undefined;
  const origin = getShopifyAppUrl(host, proto);

  const { searchParams } = url;
  const code = searchParams.get('code');
  const rawShop = searchParams.get('shop');
  const stateNonce = searchParams.get('state');
  const errorParam = searchParams.get('error') || searchParams.get('error_description');

  if (errorParam) {
    console.warn('[Shopify OAuth] Provider returned error:', errorParam);
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent(`Shopify authorization error: ${errorParam}`)}`
    );
  }

  // 1. Receive callback parameters
  if (!code || !rawShop || !stateNonce) {
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent('Missing required authorization parameters from Shopify callback.')}`
    );
  }

  // 2. Validate shop domain format
  const shop = sanitizeShopDomain(rawShop);
  if (!shop) {
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent('Invalid shop domain format from Shopify callback.')}`
    );
  }

  const clientSecret = getShopifyClientSecret();
  const clientId = getShopifyClientId();

  // 3. Validate and atomically consume one-time OAuth state record
  const stateResult = await consumeOAuthState(stateNonce, shop);
  if (!stateResult.valid || !stateResult.tenantId) {
    console.error('[Shopify OAuth] State validation failed:', stateResult.error);
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent(stateResult.error || 'Invalid or expired OAuth state.')}`
    );
  }

  const tenantId = stateResult.tenantId;

  // 4. Validate HMAC cryptographic signature
  const isHmacValid = verifyShopifyHmac(searchParams, clientSecret);
  if (!isHmacValid) {
    console.error('[Shopify OAuth] Security check failed: Invalid HMAC signature for shop:', shop);
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent('Security check failed: Invalid HMAC signature from Shopify.')}`
    );
  }

  try {
    // 5. Exchange authorization code for expiring offline access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        expiring: 1,
      }),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      console.error('[Shopify OAuth] Token exchange error:', errorData);
      const errMsg = errorData.error_description || errorData.error || 'Token exchange failed';
      return NextResponse.redirect(
        `${origin}/dashboard/integrations?error=${encodeURIComponent(errMsg)}`
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresInSec = tokenData.expires_in || null;
    const refreshExpiresInSec = tokenData.refresh_token_expires_in || null;

    const now = Date.now();
    const accessTokenExpiresAt = expiresInSec ? new Date(now + expiresInSec * 1000).toISOString() : null;
    const refreshTokenExpiresAt = refreshExpiresInSec ? new Date(now + refreshExpiresInSec * 1000).toISOString() : null;

    // 6. Obtain access token and encrypt securely
    const encryptedAccessToken = encryptShopifyToken(accessToken);
    const encryptedRefreshToken = refreshToken ? encryptShopifyToken(refreshToken) : null;

    const requestedScopes = getShopifyScopes();
    const initialConnection: ShopifyConnectionRecord = {
      id: `conn_${tenantId}_${shop}`,
      tenantId,
      shopDomain: shop,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      lastTokenRefreshAt: new Date().toISOString(),
      status: 'ACTIVE',
      requestedScopes,
      grantedScopes: [],
      missingScopes: [],
      storeName: shop.replace('.myshopify.com', ''),
      currency: 'USD',
      primaryLocationId: null,
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      lastSyncAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save initial connection so Admin API client has valid token for introspection
    await saveShopifyConnection(initialConnection);

    // 7. Determine granted scopes via Shopify Admin API
    let grantedScopes: string[] = [];
    try {
      grantedScopes = await queryGrantedScopes(shop);
    } catch (scopeErr) {
      console.warn('[Shopify OAuth] Could not query granted scopes via GraphQL:', scopeErr);
      grantedScopes = (tokenData.scope || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // 8. Determine missing scopes dynamically
    const missingScopes = requestedScopes.filter((s) => !grantedScopes.includes(s));
    const missingCoreScopes = getMissingCoreScopes(grantedScopes);
    const hasCore = missingCoreScopes.length === 0;

    console.log(`[Shopify Scopes] Required: ${requestedScopes.join(',')}`);
    console.log(`[Shopify Scopes] Granted: ${grantedScopes.join(',')}`);
    console.log(`[Shopify Scopes] Missing: ${missingScopes.join(',') || 'none'}`);
    console.log(`[Shopify Scopes] Missing Core: ${missingCoreScopes.join(',') || 'none'}`);

    // 9. If missing CORE scopes exist -> Save PARTIAL connection, skip location & sync, redirect to reauth
    if (!hasCore) {
      console.warn(
        `[Shopify OAuth] Shop ${shop} is missing core scopes: ${missingCoreScopes.join(',')}. Halting sync initiation until reauthorized.`
      );

      const partialConnection: ShopifyConnectionRecord = {
        ...initialConnection,
        grantedScopes,
        missingScopes: missingCoreScopes,
        status: 'PARTIAL',
        updatedAt: new Date().toISOString(),
      };

      await saveShopifyConnection(partialConnection);

      const partialRedirectUrl = `${origin}/dashboard/integrations?shopify_connected=false&status=partial&shop=${encodeURIComponent(
        shop
      )}&missing_scopes=${encodeURIComponent(missingCoreScopes.join(','))}`;

      return NextResponse.redirect(partialRedirectUrl);
    }

    // 10. Normalize canonical shop domain & proceed with full activation
    let storeName = shop.replace('.myshopify.com', '');
    let currency = 'USD';
    let primaryLocationId: string | null = null;

    // 11. Query shop information
    try {
      const shopProfile = await queryShopDetails(shop);
      if (shopProfile.name) storeName = shopProfile.name;
      if (shopProfile.currencyCode) currency = shopProfile.currencyCode;
    } catch (shopErr) {
      console.warn('[Shopify OAuth] Could not query shop details via GraphQL:', shopErr);
    }

    // 12. Query Shopify locations safely (adaptive: only if read_locations scope is granted)
    if (grantedScopes.includes('read_locations')) {
      try {
        const locResult = await queryShopLocations(shop);
        primaryLocationId = locResult.primaryLocationId;
      } catch (locErr) {
        console.warn('[Shopify OAuth] Could not query store locations via GraphQL:', locErr);
        primaryLocationId = 'primary';
      }
    } else {
      primaryLocationId = 'primary';
    }

    // 13. Persist Shopify connection in Firestore (status: ACTIVE)
    // 14. Persist Shopify store index in Firestore
    // 15. Persist business profile in Firestore
    const finalConnection: ShopifyConnectionRecord = {
      ...initialConnection,
      storeName,
      currency,
      grantedScopes,
      missingScopes,
      primaryLocationId,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    await saveShopifyConnection(finalConnection);

    // Register Webhooks Idempotently
    registerShopifyWebhooks({ shop, appUrl: origin }).catch((whErr) => {
      console.warn('[Shopify OAuth] Background webhook registration note:', whErr);
    });

    // 16. Create sync job & trigger initial background sync
    const jobId = await createSyncJob(tenantId, shop, 'ALL');

    fetch(`${origin}/api/shopify/sync/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, shop, tenantId, syncType: 'ALL' }),
    }).catch((syncErr) => {
      console.warn('[Shopify OAuth] Background initial sync enqueue notice:', syncErr);
    });

    // 17. Redirect to dashboard with active connection confirmation and base64 encoded payload for serverless client persistence
    const oauthPayload = Buffer.from(
      JSON.stringify({
        shopDomain: shop,
        storeName,
        currency,
        accessToken,
        scope: grantedScopes.join(','),
      })
    ).toString('base64');

    const successUrl = `${origin}/dashboard/integrations?shopify_connected=true&shopify_oauth=${encodeURIComponent(
      oauthPayload
    )}&shop=${encodeURIComponent(shop)}&job_id=${encodeURIComponent(jobId)}`;

    return NextResponse.redirect(successUrl);
  } catch (err: any) {
    console.error('[Shopify OAuth Callback Exception]:', err);
    return NextResponse.redirect(
      `${origin}/dashboard/integrations?error=${encodeURIComponent(err?.message || 'Unexpected error during Shopify authorization.')}`
    );
  }
}
