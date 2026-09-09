import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getShopifyClientId,
  getShopifyScopes,
  getShopifyAppUrl,
  sanitizeShopDomain,
} from '@/lib/shopify/config';
import { saveOAuthState } from '@/lib/shopify/connection-store';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';

function getOAuthRedirectUri(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || undefined;
  const proto = req.headers.get('x-forwarded-proto') || undefined;
  const appUrl = getShopifyAppUrl(host, proto);
  return `${appUrl}/api/shopify/callback`;
}

/**
 * POST /api/shopify/auth
 * Authenticated initiation of Shopify OAuth flow.
 * Verifies caller session server-side, generates atomic one-time state, and returns auth URL.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveServerTenant(req);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in with a valid AnalyzeUp session to connect Shopify.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawShop = body.shop;

    if (!rawShop) {
      return NextResponse.json(
        { error: 'Missing shop parameter. Please enter your Shopify store domain (e.g. your-store.myshopify.com).' },
        { status: 400 }
      );
    }

    const shop = sanitizeShopDomain(rawShop);
    if (!shop) {
      return NextResponse.json(
        { error: 'Invalid Shopify store domain format. Expected: your-store.myshopify.com' },
        { status: 400 }
      );
    }

    const clientId = getShopifyClientId();
    let requestedScopes: string[] = getShopifyScopes();
    if (Array.isArray(body.scopes) && body.scopes.length > 0) {
      requestedScopes = body.scopes.map((s: string) => String(s).trim()).filter(Boolean);
    } else if (typeof body.scopes === 'string' && body.scopes.trim()) {
      requestedScopes = body.scopes.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    // Ensure core scopes are included for baseline function
    const scopes = Array.from(new Set(['read_products', 'read_orders', 'read_inventory', ...requestedScopes])).join(',');
    const redirectUri = getOAuthRedirectUri(req);

    // Generate cryptographically secure one-time state nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;

    await saveOAuthState({
      nonce,
      tenantId: tenant.tenantId,
      normalizedShopDomain: shop,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + tenMinutesMs).toISOString(),
      consumedAt: null,
    });

    const authUrl =
      `https://${shop}/admin/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${encodeURIComponent(nonce)}`;

    return NextResponse.json({
      success: true,
      authUrl,
      shop,
      scopes: scopes.split(','),
    });
  } catch (error: any) {
    console.error('[Shopify Auth Initiation Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to initiate Shopify authorization.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shopify/auth
 * Support for direct installation links from Shopify App Store / Partner Dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawShop = searchParams.get('shop');

  if (!rawShop) {
    return NextResponse.json(
      { error: 'Missing shop parameter. Please provide your Shopify store URL (e.g. your-store.myshopify.com).' },
      { status: 400 }
    );
  }

  const shop = sanitizeShopDomain(rawShop);
  if (!shop) {
    return NextResponse.json(
      { error: 'Invalid Shopify store domain format. Expected: your-store.myshopify.com' },
      { status: 400 }
    );
  }

  // If a tenant session is available, resolve it; otherwise set placeholder to bind upon login
  const tenant = await resolveServerTenant(req);
  const tenantId = tenant?.tenantId || 'pending_authorization';

  const clientId = getShopifyClientId();
  const scopes = getShopifyScopes().join(',');
  const redirectUri = getOAuthRedirectUri(req);

  const nonce = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const tenMinutesMs = 10 * 60 * 1000;

  await saveOAuthState({
    nonce,
    tenantId,
    normalizedShopDomain: shop,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + tenMinutesMs).toISOString(),
    consumedAt: null,
  });

  const authUrl =
    `https://${shop}/admin/oauth/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${encodeURIComponent(nonce)}`;

  return NextResponse.redirect(authUrl);
}
