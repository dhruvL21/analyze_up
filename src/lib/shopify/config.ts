/**
 * Shopify Configuration & Centralized Versioning
 * Standardizes API versions, scopes, endpoints, and credentials across AnalyzeUp.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function getEnvFallback(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(new RegExp(`^${key}=([^\\r\\n]+)`, 'm'));
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = val;
          return val;
        }
      }
    }
  } catch {}
  return undefined;
}

/**
 * Single centralized configuration value for supported stable Shopify Admin API version.
 * Configured as 2026-07. Overridable via SHOPIFY_API_VERSION environment variable.
 */
export const SHOPIFY_API_VERSION = (process.env.SHOPIFY_API_VERSION || '2026-07').trim();

export function getShopifyApiVersion(): string {
  return (process.env.SHOPIFY_API_VERSION || getEnvFallback('SHOPIFY_API_VERSION') || SHOPIFY_API_VERSION).trim();
}

export function getShopifyClientId(): string {
  const clientId =
    process.env.SHOPIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ||
    getEnvFallback('SHOPIFY_CLIENT_ID') ||
    getEnvFallback('NEXT_PUBLIC_SHOPIFY_CLIENT_ID');
  if (!clientId) {
    throw new Error('SHOPIFY_CLIENT_ID environment variable is missing on server.');
  }
  return clientId.trim();
}

export function getShopifyClientSecret(): string {
  const secret =
    process.env.SHOPIFY_CLIENT_SECRET ||
    getEnvFallback('SHOPIFY_CLIENT_SECRET');
  if (!secret) {
    throw new Error('SHOPIFY_CLIENT_SECRET environment variable is missing on server.');
  }
  return secret.trim();
}

/**
 * Exactly the 5 required scopes for AnalyzeUp to synchronize products, variants, orders,
 * multi-location inventory, and locations, with inventory write capability.
 */
export const REQUIRED_SHOPIFY_SCOPES = [
  'read_products',
  'read_orders',
  'read_inventory',
  'read_locations',
  'write_inventory',
] as const;

export type RequiredShopifyScope = (typeof REQUIRED_SHOPIFY_SCOPES)[number];

/**
 * Core scopes strictly required for read synchronization, analytics, catalog ingestion,
 * and multi-location inventory reporting.
 */
export const CORE_SHOPIFY_SCOPES = [
  'read_products',
  'read_orders',
  'read_inventory',
] as const;

export type CoreShopifyScope = (typeof CORE_SHOPIFY_SCOPES)[number];

/**
 * Optional enhanced scopes for outbound adjustments or extended location metadata.
 */
export const OPTIONAL_SHOPIFY_SCOPES = [
  'read_locations',
  'write_inventory',
] as const;

export type OptionalShopifyScope = (typeof OPTIONAL_SHOPIFY_SCOPES)[number];

/**
 * Checks if a store has granted all core read and inventory scopes.
 * Supports aliases such as 'read_all_orders' for 'read_orders'.
 */
export function hasCoreShopifyScopes(grantedScopes: string[]): boolean {
  const granted = new Set(grantedScopes || []);
  const hasProducts = granted.has('read_products');
  const hasOrders = granted.has('read_orders') || granted.has('read_all_orders');
  const hasInventory = granted.has('read_inventory');
  return hasProducts && hasOrders && hasInventory;
}

/**
 * Returns any missing core scopes for a store.
 */
export function getMissingCoreScopes(grantedScopes: string[]): string[] {
  const granted = new Set(grantedScopes || []);
  const missing: string[] = [];
  if (!granted.has('read_products')) missing.push('read_products');
  if (!granted.has('read_orders') && !granted.has('read_all_orders')) missing.push('read_orders');
  if (!granted.has('read_inventory')) missing.push('read_inventory');
  return missing;
}

export function getShopifyScopes(): string[] {
  const raw = process.env.SHOPIFY_SCOPES;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...REQUIRED_SHOPIFY_SCOPES];
}

export function getShopifyAppUrl(incomingHost?: string, incomingProto?: string): string {
  const envUrl = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '');
  }
  if (incomingHost) {
    const isLocal = incomingHost.includes('localhost') || incomingHost.includes('127.0.0.1');
    const proto = incomingProto || (isLocal ? 'http' : 'https');
    return `${proto}://${incomingHost}`.replace(/\/$/, '');
  }
  return (envUrl || 'http://localhost:9002').replace(/\/$/, '');
}

/**
 * Normalizes and validates a raw merchant domain into standard 'store.myshopify.com' format.
 * Supports:
 *  - "my-store" -> "my-store.myshopify.com"
 *  - "my-store.myshopify.com" -> "my-store.myshopify.com"
 *  - "https://my-store.myshopify.com/admin" -> "my-store.myshopify.com"
 *  - "https://admin.shopify.com/store/my-store" -> "my-store.myshopify.com"
 */
export function sanitizeShopDomain(rawShop: string): string | null {
  if (!rawShop) return null;
  let shop = rawShop.trim().toLowerCase();

  // If user pasted an admin URL like https://admin.shopify.com/store/my-store-handle
  const adminMatch = shop.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9\-]+)/);
  if (adminMatch && adminMatch[1]) {
    shop = `${adminMatch[1]}.myshopify.com`;
  } else {
    shop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!shop.includes('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }
  }

  const validShopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  return validShopRegex.test(shop) ? shop : null;
}

/**
 * Returns the GraphQL Admin API endpoint for a given shop using the configured API version.
 */
export function getShopifyGraphQLEndpoint(shop: string): string {
  const version = getShopifyApiVersion();
  return `https://${shop}/admin/api/${version}/graphql.json`;
}
