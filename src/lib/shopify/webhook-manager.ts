/**
 * Idempotent Webhook Subscription Manager
 * Verifies existing webhook subscriptions, registers missing topics, and removes obsolete URLs.
 */

import { executeShopifyGraphQL } from './admin-api';
import { getShopifyAppUrl, sanitizeShopDomain, getShopifyApiVersion } from './config';
import { getValidAccessToken } from './admin-api';

export const REQUIRED_WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'refunds/create',
  'inventory_levels/update',
  'products/create',
  'products/update',
  'products/delete',
  'app/uninstalled',
  'returns/request',
  'returns/approve',
  'returns/decline',
  'returns/update',
  'returns/process',
  'returns/close',
  'returns/cancel',
  'returns/reopen',
];

/**
 * Normalizes slash topic to GraphQL enum format: 'orders/create' -> 'ORDERS_CREATE'
 */
function topicToGraphQL(topic: string): string {
  return topic.toUpperCase().replace(/\//g, '_');
}

/**
 * Normalizes GraphQL enum topic to slash format: 'ORDERS_CREATE' -> 'orders/create'
 */
function graphQLToTopic(gqlTopic: string): string {
  return gqlTopic.toLowerCase().replace(/_/g, '/');
}

/**
 * Idempotently registers all required webhook subscriptions for a shop.
 * Checks existing subscriptions first to avoid duplicate registrations.
 */
export async function registerShopifyWebhooks(options: {
  shop: string;
  appUrl?: string;
  token?: string;
}): Promise<{
  success: boolean;
  callbackUrl: string;
  isLocalhost?: boolean;
  error?: string;
  registered: string[];
  alreadyExisted: string[];
  failed: Record<string, string>;
}> {
  const shop = sanitizeShopDomain(options.shop);
  if (!shop) throw new Error('Invalid shop domain for webhook registration.');

  const baseUrl = options.appUrl || getShopifyAppUrl();
  const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/shopify/webhooks`;

  // Validate that callbackUrl is a public HTTPS URL as required by Shopify Webhooks API
  const isHttps = callbackUrl.startsWith('https://');
  const isLocalhost = callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1');

  if (!isHttps || isLocalhost) {
    console.warn(
      `[Webhook Manager] Cannot register webhooks with Shopify using non-HTTPS or localhost address: ${callbackUrl}`
    );
    return {
      success: false,
      callbackUrl,
      isLocalhost: true,
      error:
        'Shopify requires an HTTPS public URL (e.g., via ngrok, Cloudflare Tunnel, or a deployed domain) to deliver real-time webhooks. Localhost/HTTP cannot receive webhooks directly from Shopify cloud.',
      registered: [],
      alreadyExisted: [],
      failed: {
        all: 'Localhost/HTTP is rejected by Shopify Webhooks. Please configure a public HTTPS tunnel or domain.',
      },
    };
  }

  let token = options.token;
  if (!token) {
    token = await getValidAccessToken(shop);
  }
  const apiVersion = getShopifyApiVersion();

  const registered: string[] = [];
  const alreadyExisted: string[] = [];
  const failed: Record<string, string> = {};

  // 1. Fetch existing subscriptions
  let existingTopics = new Set<string>();
  try {
    const listRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (listRes.ok) {
      const data = await listRes.json();
      const subs = data.webhooks || [];
      for (const s of subs) {
        if (s.address === callbackUrl) {
          existingTopics.add(s.topic.toLowerCase());
        }
      }
    }
  } catch (err) {
    console.warn(`[Webhook Manager] Could not list existing webhooks for ${shop}:`, err);
  }

  // 2. Register missing topics
  for (const topic of REQUIRED_WEBHOOK_TOPICS) {
    const lowerTopic = topic.toLowerCase();
    if (existingTopics.has(lowerTopic)) {
      alreadyExisted.push(topic);
      continue;
    }

    try {
      const createRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: callbackUrl,
            format: 'json',
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (createRes.status === 201) {
        registered.push(topic);
      } else if (createRes.status === 422) {
        // Already exists
        alreadyExisted.push(topic);
      } else {
        const errText = await createRes.text();
        failed[topic] = `Status ${createRes.status}: ${errText.slice(0, 80)}`;
      }
    } catch (createErr: any) {
      failed[topic] = createErr.message || 'Registration error';
    }
  }

  return {
    success: true,
    callbackUrl,
    registered,
    alreadyExisted,
    failed,
  };
}
