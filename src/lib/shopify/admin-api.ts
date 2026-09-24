/**
 * Centralized Shopify GraphQL Admin API Client & Token Manager
 * All Shopify Admin API requests must route through this client.
 * Features:
 *  - Automatic token refresh & rotation before expiration (< 5 min)
 *  - Concurrency mutex lock to prevent double-refresh races
 *  - Automatic 401 retry-with-refresh
 *  - Automatic 429 rate limit backoff using extensions.cost.throttleStatus
 *  - Zero token logging or frontend exposure
 */

import {
  getShopifyGraphQLEndpoint,
  getShopifyClientId,
  getShopifyClientSecret,
  sanitizeShopDomain,
  getShopifyScopes,
  hasCoreShopifyScopes,
  getMissingCoreScopes,
} from './config';
import { decryptShopifyToken, encryptShopifyToken } from './crypto';
import { getShopifyConnection, saveShopifyConnection } from './connection-store';
import type { ShopifyConnectionRecord } from './types';

// Mutex locks to serialize token refreshes for the same shop
const tokenRefreshLocks = new Map<string, Promise<string>>();

export class ShopifyGraphQLError extends Error {
  public status: number;
  public errorCode: string;
  public userErrors?: Array<{ field?: string[]; message: string }>;
  public graphqlErrors?: Array<{ message: string; locations?: any; path?: any }>;

  constructor(
    message: string,
    status: number = 400,
    details?: { userErrors?: any[]; graphqlErrors?: any[]; errorCode?: string }
  ) {
    super(message);
    this.name = 'ShopifyGraphQLError';
    this.status = status;
    this.userErrors = details?.userErrors;
    this.graphqlErrors = details?.graphqlErrors;
    this.errorCode = details?.errorCode || (status === 429 ? 'SHOPIFY_RATE_LIMITED' : 'SHOPIFY_GRAPHQL_ERROR');
  }
}

/**
 * Returns a valid, non-expired Shopify access token for the given shop.
 * Automatically refreshes expiring offline tokens if within 5 minutes of expiration.
 */
export async function getValidAccessToken(rawShop: string, forceRefresh = false): Promise<string> {
  const shop = sanitizeShopDomain(rawShop);
  if (!shop) throw new Error('Invalid shop domain provided to getValidAccessToken.');

  // If a refresh is already in flight for this shop, wait for it
  const existingLock = tokenRefreshLocks.get(shop);
  if (existingLock && !forceRefresh) {
    return await existingLock;
  }

  const connection = await getShopifyConnection(shop);
  if (!connection) {
    throw new Error(`No active Shopify connection found for store: ${shop}`);
  }

  if (connection.status === 'UNINSTALLED' || !connection.encryptedAccessToken) {
    throw new Error(`Shopify store "${shop}" is uninstalled or disconnected.`);
  }

  const decryptedToken = decryptShopifyToken(connection.encryptedAccessToken);

  // Check if token is non-expiring (e.g. legacy/dev store custom app token)
  if (!connection.accessTokenExpiresAt && !connection.encryptedRefreshToken) {
    return decryptedToken;
  }

  // Check expiration if expiresAt is set
  const expiresAtMs = connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt).getTime() : Infinity;
  const fiveMinutesMs = 5 * 60 * 1000;
  const isNearExpiry = Date.now() + fiveMinutesMs >= expiresAtMs;

  if (!isNearExpiry && !forceRefresh) {
    return decryptedToken;
  }

  // If token is expiring or refresh forced, execute atomic refresh with lock
  const refreshPromise = (async () => {
    try {
      if (!connection.encryptedRefreshToken) {
        // Cannot refresh without refresh token; return current token
        return decryptedToken;
      }

      const decryptedRefreshToken = decryptShopifyToken(connection.encryptedRefreshToken);
      const clientId = getShopifyClientId();
      const clientSecret = getShopifyClientSecret();

      const refreshRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: decryptedRefreshToken,
        }),
      });

      if (!refreshRes.ok) {
        const errText = await refreshRes.text();
        console.warn(`[Shopify OAuth] Refresh token exchange returned (${refreshRes.status}): ${errText.slice(0, 100)}. Falling back to existing token.`);
        return decryptedToken;
      }

      const tokenData = await refreshRes.json();
      const newAccessToken = tokenData.access_token;
      const newRefreshToken = tokenData.refresh_token || decryptedRefreshToken;
      const expiresInSec = tokenData.expires_in || 86400;
      const refreshExpiresInSec = tokenData.refresh_token_expires_in || 7776000;

      const now = Date.now();
      const updatedConnection: ShopifyConnectionRecord = {
        ...connection,
        encryptedAccessToken: encryptShopifyToken(newAccessToken),
        encryptedRefreshToken: encryptShopifyToken(newRefreshToken),
        accessTokenExpiresAt: new Date(now + expiresInSec * 1000).toISOString(),
        refreshTokenExpiresAt: new Date(now + refreshExpiresInSec * 1000).toISOString(),
        lastTokenRefreshAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      };

      await saveShopifyConnection(updatedConnection);
      return newAccessToken;
    } finally {
      tokenRefreshLocks.delete(shop);
    }
  })();

  tokenRefreshLocks.set(shop, refreshPromise);
  return await refreshPromise;
}

export interface ExecuteGraphQLOptions {
  shop: string;
  query: string;
  variables?: Record<string, any>;
  idempotencyKey?: string;
  extraHeaders?: Record<string, string>;
  retryOnAuthFailure?: boolean;
  maxRateLimitRetries?: number;
}

/**
 * Centralized executor for all Shopify GraphQL Admin API operations.
 */
export async function executeShopifyGraphQL<T = any>(options: ExecuteGraphQLOptions): Promise<T> {
  const {
    shop: rawShop,
    query,
    variables = {},
    idempotencyKey,
    extraHeaders,
    retryOnAuthFailure = true,
    maxRateLimitRetries = 3,
  } = options;

  const shop = sanitizeShopDomain(rawShop);
  if (!shop) throw new Error('Invalid shop domain format.');

  const endpoint = getShopifyGraphQLEndpoint(shop);

  let attempt = 0;
  while (attempt <= maxRateLimitRetries) {
    const accessToken = await getValidAccessToken(shop);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        ...(idempotencyKey
          ? {
              'Idempotency-Key': idempotencyKey,
              'X-Shopify-Idempotency-Key': idempotencyKey,
            }
          : {}),
        ...extraHeaders,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20000),
    });

    // 1. Handle 401 Unauthorized: Attempt one immediate token refresh and retry
    if (res.status === 401 && retryOnAuthFailure && attempt === 0) {
      console.warn(`[Shopify GraphQL Client] 401 Unauthorized for ${shop}. Forcing token refresh...`);
      await getValidAccessToken(shop, true);
      attempt++;
      continue;
    }

    // 2. Handle 429 Rate Limit
    if (res.status === 429) {
      if (attempt >= maxRateLimitRetries) {
        throw new ShopifyGraphQLError('Shopify API rate limit exceeded after retries (429).', 429);
      }
      const retryAfter = Number(res.headers.get('Retry-After') || 1);
      const backoffMs = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt)) + Math.random() * 500;
      console.warn(`[Shopify GraphQL Client] 429 Throttled for ${shop}. Backing off for ${Math.round(backoffMs)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      attempt++;
      continue;
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new ShopifyGraphQLError(`Shopify HTTP ${res.status}: ${errBody.slice(0, 150)}`, res.status);
    }

    const json = await res.json();

    // 3. Handle GraphQL-level throttling cost
    if (json.extensions?.cost?.throttleStatus) {
      const { currentlyAvailable, restoreRate } = json.extensions.cost.throttleStatus;
      if (currentlyAvailable < 50 && restoreRate > 0) {
        // Proactive sleep to avoid hitting 429 on subsequent query
        const sleepMs = Math.round(((50 - currentlyAvailable) / restoreRate) * 1000);
        if (sleepMs > 0 && sleepMs < 3000) {
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
      }
    }

    // 4. Handle Top-Level GraphQL Errors
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const firstMsg = json.errors[0]?.message || 'Shopify GraphQL query failed.';
      const isScopeError = json.errors.some(
        (e: any) =>
          typeof e?.message === 'string' &&
          (e.message.toLowerCase().includes('access scope') ||
            e.message.toLowerCase().includes('access denied') ||
            e.message.toLowerCase().includes('read_locations') ||
            e.message.toLowerCase().includes('write_inventory'))
      );
      if (isScopeError) {
        console.warn(`[Shopify GraphQL] Access scope permission denied: ${firstMsg}`);
      }
      throw new ShopifyGraphQLError(firstMsg, isScopeError ? 403 : 400, {
        graphqlErrors: json.errors,
        errorCode: isScopeError ? 'SHOPIFY_MISSING_SCOPE' : 'SHOPIFY_GRAPHQL_ERROR',
      });
    }

    return json.data as T;
  }

  throw new ShopifyGraphQLError('Shopify GraphQL request failed unexpectedly.');
}

/**
 * Queries active store locations via GraphQL and returns primary location ID.
 */
export async function queryShopLocations(shop: string): Promise<{
  locations: Array<{ id: string; name: string; isActive: boolean; shipsInventory: boolean }>;
  primaryLocationId: string | null;
}> {
  const query = `
    query GetLocations {
      locations(first: 25, includeInactive: false) {
        nodes {
          id
          name
          isActive
          shipsInventory
        }
      }
    }
  `;

  const data = await executeShopifyGraphQL<{ locations: { nodes: any[] } }>({
    shop,
    query,
  });

  const locations = (data?.locations?.nodes || []).map((loc) => ({
    id: String(loc.id),
    name: String(loc.name),
    isActive: Boolean(loc.isActive),
    shipsInventory: Boolean(loc.shipsInventory),
  }));

  const primary = locations.find((l) => l.shipsInventory && l.isActive) || locations[0] || null;

  return {
    locations,
    primaryLocationId: primary ? primary.id : null,
  };
}

/**
 * Queries currentAppInstallation.accessScopes via GraphQL.
 */
export async function queryGrantedScopes(shop: string): Promise<string[]> {
  const query = `
    query GetGrantedScopes {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
    }
  `;

  const data = await executeShopifyGraphQL<{
    currentAppInstallation: { accessScopes: Array<{ handle: string }> };
  }>({
    shop,
    query,
  });

  return (data?.currentAppInstallation?.accessScopes || []).map((s) => s.handle);
}

/**
 * Resolves granted scopes from Shopify and dynamically determines missing required scopes.
 * Verifies against the 5 required scopes: read_products, read_orders, read_inventory, read_locations, write_inventory.
 */
export async function getShopifyGrantedScopes(shop: string): Promise<{
  requiredScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  isAuthorized: boolean;
  hasCoreScopes: boolean;
  missingCoreScopes: string[];
}> {
  const requiredScopes = getShopifyScopes();
  let grantedScopes: string[] = [];

  try {
    grantedScopes = await queryGrantedScopes(shop);
  } catch (err: any) {
    console.warn(`[Shopify Scopes] Failed to query granted scopes via GraphQL for ${shop}:`, err?.message || err);
    // Fallback: check stored connection if available
    const conn = await getShopifyConnection(shop);
    if (conn?.grantedScopes?.length) {
      grantedScopes = conn.grantedScopes;
    }
  }

  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  const isAuthorized = missingScopes.length === 0;
  const hasCoreScopes = hasCoreShopifyScopes(grantedScopes);
  const missingCoreScopes = getMissingCoreScopes(grantedScopes);

  console.log(`[Shopify Scopes] Required: ${requiredScopes.join(',')}`);
  console.log(`[Shopify Scopes] Granted: ${grantedScopes.join(',')}`);
  console.log(`[Shopify Scopes] Missing: ${missingScopes.join(',') || 'none'}`);
  console.log(`[Shopify Scopes] Missing Core: ${missingCoreScopes.join(',') || 'none'}`);

  return {
    requiredScopes,
    grantedScopes,
    missingScopes,
    isAuthorized,
    hasCoreScopes,
    missingCoreScopes,
  };
}

/**
 * Queries shop profile information (name, currency, domain, email) via GraphQL Admin API.
 */
export async function queryShopDetails(shop: string): Promise<{
  name: string;
  currencyCode: string;
  myshopifyDomain?: string;
  email?: string;
}> {
  const query = `
    query GetShopDetails {
      shop {
        name
        currencyCode
        myshopifyDomain
        email
      }
    }
  `;

  try {
    const data = await executeShopifyGraphQL<{
      shop: {
        name: string;
        currencyCode: string;
        myshopifyDomain?: string;
        email?: string;
      };
    }>({
      shop,
      query,
    });

    return {
      name: data?.shop?.name || shop.replace('.myshopify.com', ''),
      currencyCode: data?.shop?.currencyCode || 'USD',
      myshopifyDomain: data?.shop?.myshopifyDomain,
      email: data?.shop?.email,
    };
  } catch (err) {
    console.warn('[Shopify Admin API] queryShopDetails fallback notice:', err);
    return {
      name: shop.replace('.myshopify.com', ''),
      currencyCode: 'USD',
    };
  }
}

/**
 * Adjusts available inventory quantity for a given inventory item and location via GraphQL.
 * Supports Shopify 2026-07 mandatory idempotency mechanism (@idempotent directive and Idempotency-Key header).
 * Requires `write_inventory` scope.
 */
export async function adjustShopifyInventory(options: {
  shop: string;
  inventoryItemId: string; // e.g. "gid://shopify/InventoryItem/123" or "123"
  locationId: string; // e.g. "gid://shopify/Location/456" or "456"
  delta: number;
  reason?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; quantityAfterChange?: number; userErrors?: any[]; idempotencyKey?: string }> {
  const { shop, delta, reason = 'restock' } = options;
  const idempotencyKey = options.idempotencyKey || `inv_adj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let invItemId = options.inventoryItemId;
  if (!invItemId.startsWith('gid://shopify/InventoryItem/')) {
    invItemId = `gid://shopify/InventoryItem/${invItemId}`;
  }

  let locId = options.locationId;
  if (!locId.startsWith('gid://shopify/Location/')) {
    locId = `gid://shopify/Location/${locId}`;
  }

  const mutation = `
    mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!, $idempotencyKey: String!) @idempotent(key: $idempotencyKey) {
      inventoryAdjustQuantities(input: $input) {
        userErrors {
          field
          message
        }
        inventoryAdjustmentGroup {
          id
          reason
          changes {
            name
            delta
            quantityAfterChange
            item {
              id
              sku
            }
            location {
              id
              name
            }
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      reason,
      name: 'available',
      changes: [
        {
          inventoryItemId: invItemId,
          locationId: locId,
          delta,
        },
      ],
    },
    idempotencyKey,
  };

  const data = await executeShopifyGraphQL<{
    inventoryAdjustQuantities: {
      userErrors: any[];
      inventoryAdjustmentGroup?: {
        changes: Array<{ quantityAfterChange: number }>;
      };
    };
  }>({
    shop,
    query: mutation,
    variables,
    idempotencyKey,
  });

  const userErrors = data?.inventoryAdjustQuantities?.userErrors || [];
  if (userErrors.length > 0) {
    return { success: false, userErrors, idempotencyKey };
  }

  const change = data?.inventoryAdjustQuantities?.inventoryAdjustmentGroup?.changes?.[0];
  return {
    success: true,
    quantityAfterChange: change?.quantityAfterChange,
    idempotencyKey,
  };
}

/**
 * Creates an authorized customer sales order in Shopify via GraphQL orderCreate mutation.
 * Supports Shopify 2026-07 idempotency mechanism (@idempotent directive and Idempotency-Key header).
 */
export async function createShopifySalesOrder(options: {
  shop: string;
  orderInput: any;
  idempotencyKey?: string;
}): Promise<{ success: boolean; orderId?: string; orderName?: string; userErrors?: any[]; idempotencyKey?: string }> {
  const { shop, orderInput } = options;
  const idempotencyKey = options.idempotencyKey || `order_create_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const mutation = `
    mutation CreateOrder($order: OrderCreateOrderInput!, $idempotencyKey: String!) @idempotent(key: $idempotencyKey) {
      orderCreate(order: $order) {
        userErrors {
          field
          message
        }
        order {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  const data = await executeShopifyGraphQL<{
    orderCreate: {
      userErrors: any[];
      order?: {
        id: string;
        name: string;
      };
    };
  }>({
    shop,
    query: mutation,
    variables: { order: orderInput, idempotencyKey },
    idempotencyKey,
  });

  const userErrors = data?.orderCreate?.userErrors || [];
  if (userErrors.length > 0) {
    return { success: false, userErrors, idempotencyKey };
  }

  return {
    success: true,
    orderId: data?.orderCreate?.order?.id,
    orderName: data?.orderCreate?.order?.name,
    idempotencyKey,
  };
}
