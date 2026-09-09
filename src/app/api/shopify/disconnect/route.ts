import { NextRequest, NextResponse } from 'next/server';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { markShopifyDisconnected } from '@/lib/shopify/connection-store';

/**
  * POST /api/shopify/disconnect
  * Disconnects a Shopify merchant integration and removes active access credentials.
  */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveServerTenant(req);
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const shop = body?.shop || null;
    const tenantId = tenant?.tenantId || body?.userId || body?.tenantId;
    const purgeData = body?.purgeData !== false;

    if (!shop && !tenantId) {
      return NextResponse.json(
        { error: 'Missing required parameters: shop or tenantId is required.' },
        { status: 400 }
      );
    }

    await markShopifyDisconnected(shop, tenantId, purgeData);

    return NextResponse.json({
      success: true,
      message: 'Shopify integration has been disconnected and data purged.',
      purged: purgeData,
      disconnectedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Shopify Disconnect API Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to disconnect Shopify integration.' },
      { status: 500 }
    );
  }
}
