import { NextRequest, NextResponse } from 'next/server';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { getShopifyConnectionByTenant, getShopifyConnection } from '@/lib/shopify/connection-store';
import { sanitizeShopDomain } from '@/lib/shopify/config';

/**
 * GET /api/shopify/status
 * Returns real-time connection and synchronization status for the current merchant/tenant.
 * Strictly enforces cryptographic multi-tenant isolation:
 * Under NO circumstance will status of another tenant's store be returned.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant = await resolveServerTenant(req);
    const queryTenantId = searchParams.get('userId') || searchParams.get('tenantId');
    const tenantId = tenant?.tenantId || queryTenantId;
    const shopParam = searchParams.get('shop');

    if (!tenantId) {
      return NextResponse.json(
        { connected: false, error: 'Unauthorized. Tenant ID or authentication required.' },
        { status: 401 }
      );
    }

    let connection = null;

    if (shopParam) {
      const sanitizedShop = sanitizeShopDomain(shopParam);
      if (sanitizedShop) {
        const foundConn = await getShopifyConnection(sanitizedShop);
        // STRICT MULTI-TENANT ISOLATION GUARD:
        // Only accept if connection.tenantId matches the requesting tenantId!
        if (foundConn) {
          if (foundConn.tenantId && foundConn.tenantId !== tenantId) {
            // Connection belongs to another account! Never expose across accounts.
            return NextResponse.json({
              connected: false,
              connection: null,
            });
          }
          connection = foundConn;
        }
      }
    }

    if (!connection && tenantId) {
      connection = await getShopifyConnectionByTenant(tenantId);
    }

    if (!connection) {
      return NextResponse.json({
        connected: false,
        connection: null,
      });
    }

    // Secondary multi-tenant verification check
    if (connection.tenantId && connection.tenantId !== tenantId) {
      return NextResponse.json({
        connected: false,
        connection: null,
      });
    }

    const isConnected = connection.status === 'ACTIVE' || connection.status === 'SYNCED';

    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        status: connection.status || 'DISCONNECTED',
        connection: null,
      });
    }

    return NextResponse.json({
      connected: true,
      shop: connection.shopDomain,
      storeName: connection.storeName || connection.shopDomain.replace('.myshopify.com', ''),
      currency: connection.currency || 'USD',
      status: connection.status,
      lastSyncAt: connection.lastSyncAt,
      syncStats: connection.syncStats || null,
      primaryLocationId: connection.primaryLocationId,
    });
  } catch (error: any) {
    console.error('[Shopify Connection Status API Error]:', error);
    return NextResponse.json({ connected: false, error: error?.message }, { status: 500 });
  }
}
