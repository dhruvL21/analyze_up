import { NextRequest, NextResponse } from 'next/server';
import { sanitizeShopDomain } from '@/lib/shopify/config';
import { registerShopifyWebhooks } from '@/lib/shopify/webhook-manager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { shop: rawShop, webhookHost, accessToken } = body;

    if (!rawShop) {
      return NextResponse.json(
        { success: false, error: 'Shop domain is required.' },
        { status: 400 }
      );
    }

    const shop = sanitizeShopDomain(rawShop);
    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Invalid Shopify store URL format.' },
        { status: 400 }
      );
    }

    const registration = await registerShopifyWebhooks({
      shop,
      appUrl: webhookHost,
      token: accessToken,
    });

    return NextResponse.json({
      success: registration.success,
      shop,
      callbackUrl: registration.callbackUrl,
      isLocalhost: registration.isLocalhost,
      error: registration.error,
      registered: registration.registered,
      alreadyExisted: registration.alreadyExisted,
      failed: registration.failed,
    });
  } catch (error: any) {
    console.error('[Shopify Register Webhooks Route Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to register webhooks.' },
      { status: 500 }
    );
  }
}
