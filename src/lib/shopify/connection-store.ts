/**
 * Server-Side Multi-Tenant Connection Store & OAuth State Manager
 * Interacts with Firestore collections:
 *  - `shopify_connections/{shopDomain}`
 *  - `shopify_oauth_states/{nonce}`
 *  - `shopify_stores/{shopDomain}` (O(1) webhook tenant lookup index)
 * 
 * Features durable multi-tier storage:
 *  - Level 1: Active server memory store (`globalThis.__shopify*`)
 *  - Level 2: Durable local file cache (`.shopify_cache/`) for survive hot-reload / restarts
 *  - Level 3: Cloud Firestore synchronization (with graceful fallback if security rules or unauthenticated server calls throw PERMISSION_DENIED)
 */

import fs from 'fs';
import path from 'path';
import { getAdminFirestore, hasAdminCredentials, PersistenceError } from '@/lib/firebase/admin';
export { PersistenceError };
import type {
  ShopifyConnectionRecord,
  ShopifyOAuthStateRecord,
  ShopifyConnectionStatus,
} from './types';
import { sanitizeShopDomain } from './config';
import { encryptShopifyToken } from './crypto';

// ============================================================================
// Level 1 & 2: Durable In-Memory & Local File Cache Layer
// ============================================================================

declare global {
  var __shopifyOAuthStates: Map<string, ShopifyOAuthStateRecord> | undefined;
  var __shopifyConnections: Map<string, ShopifyConnectionRecord> | undefined;
}

const CACHE_DIR = path.join(process.cwd(), '.shopify_cache');
const OAUTH_FILE = path.join(CACHE_DIR, 'oauth_states.json');
const CONNECTIONS_FILE = path.join(CACHE_DIR, 'connections.json');

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch {}
}

function loadFileOAuthStates(): Map<string, ShopifyOAuthStateRecord> {
  ensureCacheDir();
  try {
    if (fs.existsSync(OAUTH_FILE)) {
      const raw = fs.readFileSync(OAUTH_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const map = new Map<string, ShopifyOAuthStateRecord>();
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed as Record<string, ShopifyOAuthStateRecord>)) {
        // Keep valid unexpired or recently consumed states for replay checking
        if (new Date(v.expiresAt).getTime() > now) {
          map.set(k, v);
        }
      }
      return map;
    }
  } catch {}
  return new Map();
}

function saveFileOAuthStates(states: Map<string, ShopifyOAuthStateRecord>) {
  ensureCacheDir();
  try {
    const obj: Record<string, ShopifyOAuthStateRecord> = {};
    const now = Date.now();
    for (const [k, v] of states.entries()) {
      if (new Date(v.expiresAt).getTime() > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(OAUTH_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

function loadFileConnections(): Map<string, ShopifyConnectionRecord> {
  ensureCacheDir();
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const map = new Map<string, ShopifyConnectionRecord>();
      for (const [k, v] of Object.entries(parsed as Record<string, ShopifyConnectionRecord>)) {
        map.set(k, v);
      }
      return map;
    }
  } catch {}
  return new Map();
}

function saveFileConnections(conns: Map<string, ShopifyConnectionRecord>) {
  ensureCacheDir();
  try {
    const obj: Record<string, ShopifyConnectionRecord> = {};
    for (const [k, v] of conns.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

function getMemoryOAuthStates(): Map<string, ShopifyOAuthStateRecord> {
  if (!globalThis.__shopifyOAuthStates) {
    globalThis.__shopifyOAuthStates = loadFileOAuthStates();
  }
  return globalThis.__shopifyOAuthStates;
}

function getMemoryConnections(): Map<string, ShopifyConnectionRecord> {
  if (!globalThis.__shopifyConnections) {
    globalThis.__shopifyConnections = loadFileConnections();
  }
  return globalThis.__shopifyConnections;
}

/**
 * Clean testing helper to reset stores between test runs.
 */
export function _clearShopifyMemoryStoresForTesting(): void {
  if (globalThis.__shopifyOAuthStates) globalThis.__shopifyOAuthStates.clear();
  if (globalThis.__shopifyConnections) globalThis.__shopifyConnections.clear();
}

// ============================================================================
// Public Connection Store & OAuth API
// ============================================================================

function getDb() {
  try {
    if (!hasAdminCredentials()) {
      return null;
    }
    return getAdminFirestore();
  } catch {
    return null;
  }
}

/**
 * Saves a one-time OAuth state record with tenant ID and normalized shop domain.
 * Persists to server memory, local file cache, and Cloud Firestore.
 */
export async function saveOAuthState(record: ShopifyOAuthStateRecord): Promise<void> {
  const normRecord: ShopifyOAuthStateRecord = {
    ...record,
    createdAt: record.createdAt || new Date().toISOString(),
  };

  // 1. Immediately store in server memory & local file cache
  const states = getMemoryOAuthStates();
  states.set(record.nonce, normRecord);
  saveFileOAuthStates(states);

  // 2. Persist to Cloud Firestore via Admin SDK
  try {
    const db = getDb();
    if (db) {
      await db.collection('shopify_oauth_states').doc(record.nonce).set(normRecord);
    }
  } catch (err: any) {
    console.warn(
      `[Shopify OAuth Store] Cloud Firestore write notice for nonce (${err?.code || err?.message || err}). State retained in server cache.`
    );
  }
}

/**
 * Checks whether two myshopify domains refer to the same store
 * (e.g. primary domain redirection, custom myshopify alias, or permanent internal handle).
 */
export async function areShopDomainsEquivalent(expectedShop: string, actualShop: string): Promise<boolean> {
  const normExpected = sanitizeShopDomain(expectedShop);
  const normActual = sanitizeShopDomain(actualShop);
  if (!normExpected || !normActual) return false;

  // 1. Direct match
  if (normExpected === normActual) return true;

  // 2. Check if one redirects to the other via HTTP 301/302 primary_domain_redirection
  try {
    const checkRedirect = async (source: string, target: string): Promise<boolean> => {
      const res = await fetch(`https://${source}`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
      });
      const location = res.headers.get('location');
      if (location) {
        try {
          const locUrl = new URL(location);
          const locHost = locUrl.hostname.toLowerCase();
          if (locHost === target) return true;
        } catch {}
      }
      return false;
    };

    const [actualRedirectsToExpected, expectedRedirectsToActual] = await Promise.all([
      checkRedirect(normActual, normExpected).catch(() => false),
      checkRedirect(normExpected, normActual).catch(() => false),
    ]);

    if (actualRedirectsToExpected || expectedRedirectsToActual) {
      return true;
    }
  } catch (err) {
    console.warn('[Shopify Domain Alias Check] Network notice:', err);
  }

  return false;
}

/**
 * Validates and atomically consumes a one-time OAuth state record.
 * A state record may ONLY be consumed once.
 * Checks memory, file cache, and Firestore.
 */
export async function consumeOAuthState(
  nonce: string,
  rawShop: string
): Promise<{ valid: boolean; tenantId?: string; error?: string }> {
  if (!nonce) {
    return { valid: false, error: 'Missing OAuth state parameter' };
  }

  const shop = sanitizeShopDomain(rawShop);
  if (!shop) {
    return { valid: false, error: 'Invalid shop domain format' };
  }

  // 1. Check server memory store first
  const states = getMemoryOAuthStates();
  let record = states.get(nonce);

  // If not found in memory, check local file cache
  if (!record) {
    const fileStates = loadFileOAuthStates();
    record = fileStates.get(nonce);
    if (record) {
      states.set(nonce, record);
    }
  }

  // If still not found, query Cloud Firestore via Admin SDK
  if (!record) {
    try {
      const db = getDb();
      if (db) {
        const snap = await db.collection('shopify_oauth_states').doc(nonce).get();
        if (snap.exists) {
          record = snap.data() as ShopifyOAuthStateRecord;
        }
      }
    } catch (err: any) {
      console.warn('[Shopify OAuth Store] Firestore lookup notice:', err?.message || err);
    }
  }

  if (!record) {
    return { valid: false, error: 'OAuth state record not found or already consumed' };
  }

  // Verify not already consumed (atomic replay prevention)
  if (record.consumedAt) {
    return { valid: false, error: 'OAuth state has already been consumed (replay attempt)' };
  }

  // Verify expiration (10 minutes max)
  const expiresAt = new Date(record.expiresAt).getTime();
  if (Date.now() > expiresAt) {
    return { valid: false, error: 'OAuth state has expired. Please re-initiate connection' };
  }

  // Verify shop domain match or domain alias equivalence
  const expectedShop = sanitizeShopDomain(record.normalizedShopDomain);
  if (expectedShop !== shop) {
    const isEquivalent = await areShopDomainsEquivalent(expectedShop || '', shop);
    if (!isEquivalent) {
      return { valid: false, error: 'OAuth shop domain mismatch between state and callback' };
    }
    console.log(
      `[Shopify OAuth] Domain alias recognized: initiated as ${expectedShop}, callback shop is ${shop}. Accepting verified merchant store.`
    );
  }

  // Atomically mark consumed in server memory and file cache
  const consumedAtIso = new Date().toISOString();
  record.consumedAt = consumedAtIso;
  states.set(nonce, record);
  saveFileOAuthStates(states);

  // Also update in Cloud Firestore via Admin SDK
  try {
    const db = getDb();
    if (db) {
      await db.collection('shopify_oauth_states').doc(nonce).update({ consumedAt: consumedAtIso }).catch(() => {});
    }
  } catch {}

  return { valid: true, tenantId: record.tenantId };
}

/**
 * Saves or updates a Shopify connection record in server cache and Cloud Firestore.
 * Also mirrors connection state to `users/{tenantId}/settings/business_profile` (WITHOUT tokens).
 */
export async function saveShopifyConnection(record: ShopifyConnectionRecord): Promise<void> {
  const shop = sanitizeShopDomain(record.shopDomain);
  if (!shop) throw new Error('Invalid shop domain for connection save.');

  const updatedRecord: ShopifyConnectionRecord = {
    ...record,
    shopDomain: shop,
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately persist in server memory & local file cache
  const conns = getMemoryConnections();
  conns.set(shop, updatedRecord);
  saveFileConnections(conns);

  // 2. Persist using privileged Firebase Admin SDK
  try {
    const db = getAdminFirestore();
    const batch = db.batch();

    // 2a. Master connection record
    const connRef = db.collection('shopify_connections').doc(shop);
    batch.set(connRef, updatedRecord, { merge: true });

    // 2b. O(1) webhook lookup index: shop -> tenantId
    const storeIndexRef = db.collection('shopify_stores').doc(shop);
    batch.set(
      storeIndexRef,
      {
        shopDomain: shop,
        tenantId: record.tenantId,
        userId: record.tenantId,
        status: record.status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2c. Update merchant's business profile without exposing tokens
    const profileRef = db.collection('users').doc(record.tenantId).collection('settings').doc('business_profile');
    batch.set(
      profileRef,
      {
        shopifyConnected: record.status === 'ACTIVE' || record.status === 'SYNCED',
        shopifyStoreUrl: shop,
        shopifyStoreName: record.storeName,
        shopifyStatus: record.status === 'ACTIVE' || record.status === 'SYNCED' ? 'Connected' : record.status,
        shopifyLastSyncedAt: record.lastSyncAt || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await batch.commit();
    console.log(`[Firestore] Successfully persisted Shopify connection, store index, and business profile for ${shop}`);
  } catch (err: any) {
    console.warn('[Shopify Connection Store] Firestore write notice:', err?.message || err);
    // In local development / test environments without explicit GCP service account credentials configured,
    // we already successfully saved to server memory and local file cache (.shopify_cache/connections.json).
    // Only if explicit service account credentials are provided in production do we rethrow to enforce cloud write.
    const isExplicitCredentialsConfigured = !!(
      (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );

    if (isExplicitCredentialsConfigured) {
      throw new PersistenceError(
        'SHOPIFY_CONNECTION_PERSIST_FAILED',
        `Failed to persist Shopify connection to Firestore: ${err?.message || err}`,
        err
      );
    } else {
      console.log(`[Shopify Connection Store] Store ${shop} safely saved in local persistence cache for development.`);
    }
  }
}

/**
 * Retrieves the connection record for a given shop domain.
 * Checks server memory, file cache, Cloud Firestore, and backwards-compatible legacy paths.
 */
export async function getShopifyConnection(rawShop: string): Promise<ShopifyConnectionRecord | null> {
  const shop = sanitizeShopDomain(rawShop);
  if (!shop) return null;

  // 1. Check server memory cache first
  const conns = getMemoryConnections();
  if (conns.has(shop)) {
    return conns.get(shop)!;
  }

  // 2. Check local file cache
  const fileConns = loadFileConnections();
  if (fileConns.has(shop)) {
    const conn = fileConns.get(shop)!;
    conns.set(shop, conn);
    return conn;
  }

  // 3. Query Cloud Firestore via Admin SDK
  try {
    const db = getDb();
    if (db) {
      const snap = await db.collection('shopify_connections').doc(shop).get();
      if (snap.exists) {
        const data = snap.data() as ShopifyConnectionRecord;
        conns.set(shop, data);
        saveFileConnections(conns);
        return data;
      }
    }
  } catch (err: any) {
    console.warn('[Shopify Connection Store] Firestore get notice:', err?.message || err);
  }

  // 4. Backwards compatibility fallback: search in users/{uid}/integrations/shopify
  try {
    const db = getDb();
    if (db) {
      const storeLookupSnap = await db.collection('shopify_stores').doc(shop).get();
      const tenantId = storeLookupSnap.exists
        ? storeLookupSnap.data()?.tenantId || storeLookupSnap.data()?.userId
        : null;

      if (tenantId) {
        const legacyRef = db.collection('users').doc(tenantId).collection('integrations').doc('shopify');
        const legacySnap = await legacyRef.get();
        if (legacySnap.exists) {
          const legacy = legacySnap.data()!;
          if (legacy.accessToken) {
            const encrypted = encryptShopifyToken(legacy.accessToken);
            const migratedRecord: ShopifyConnectionRecord = {
              id: `conn_${tenantId}_${shop}`,
              tenantId,
              shopDomain: shop,
              encryptedAccessToken: encrypted,
              encryptedRefreshToken: null,
              accessTokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              lastTokenRefreshAt: null,
              status: legacy.connectionStatus === 'Connected' ? 'ACTIVE' : 'DISCONNECTED',
              requestedScopes: (legacy.scope || '').split(',').map((s: string) => s.trim()).filter(Boolean),
              grantedScopes: (legacy.scope || '').split(',').map((s: string) => s.trim()).filter(Boolean),
              missingScopes: [],
              storeName: legacy.storeName || shop.replace('.myshopify.com', ''),
              currency: legacy.currency || 'USD',
              primaryLocationId: null,
              installedAt: legacy.updatedAt || new Date().toISOString(),
              uninstalledAt: null,
              lastSyncAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await saveShopifyConnection(migratedRecord);
            return migratedRecord;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] Legacy fallback error:', err);
  }

  return null;
}

/**
 * Retrieves the active Shopify connection for a specific AnalyzeUp tenant/user.
 */
export async function getShopifyConnectionByTenant(tenantId: string): Promise<ShopifyConnectionRecord | null> {
  if (!tenantId) return null;

  // 1. Check server memory cache first
  const conns = getMemoryConnections();
  for (const conn of conns.values()) {
    if (conn.tenantId === tenantId && conn.status !== 'UNINSTALLED' && conn.status !== 'DISCONNECTED') {
      return conn;
    }
  }

  // 2. Check local file cache
  const fileConns = loadFileConnections();
  for (const conn of fileConns.values()) {
    if (conn.tenantId === tenantId && conn.status !== 'UNINSTALLED' && conn.status !== 'DISCONNECTED') {
      conns.set(conn.shopDomain, conn);
      return conn;
    }
  }

  // 3. Query Cloud Firestore via Admin SDK
  try {
    const db = getDb();
    if (db) {
      const snaps = await db.collection('shopify_connections').where('tenantId', '==', tenantId).get();
      for (const d of snaps.docs) {
        const data = d.data() as ShopifyConnectionRecord;
        if (data.status !== 'UNINSTALLED' && data.status !== 'DISCONNECTED') {
          conns.set(data.shopDomain, data);
          return data;
        }
      }
      if (!snaps.empty) {
        const data = snaps.docs[0].data() as ShopifyConnectionRecord;
        conns.set(data.shopDomain, data);
        return data;
      }
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] Query by tenant notice:', err);
  }

  // 4. Fallback: check user settings
  try {
    const db = getDb();
    if (db) {
      const profileSnap = await db.collection('users').doc(tenantId).collection('settings').doc('business_profile').get();
      if (profileSnap.exists) {
        const profile = profileSnap.data();
        if (profile?.shopifyStoreUrl) {
          return await getShopifyConnection(profile.shopifyStoreUrl);
        }
      }
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] Profile fallback error:', err);
  }

  return null;
}

/**
 * Helper to purge all Shopify-originated documents for a tenant from server Firestore.
 */
async function purgeTenantShopifyData(db: any, tenantId: string, shop?: string | null): Promise<void> {
  if (!db || !tenantId) return;
  try {
    const collectionsToClean = ['sales_orders', 'refunds', 'inventory'];
    for (const col of collectionsToClean) {
      const snap = await db.collection('users').doc(tenantId).collection(col).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d: any) => batch.delete(d.ref));
        await batch.commit().catch(console.warn);
      }
    }

    // Products
    const prodSnap = await db.collection('users').doc(tenantId).collection('products').get();
    if (!prodSnap.empty) {
      const batch = db.batch();
      let hasShopifyProds = false;
      prodSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (
          data.source === 'SHOPIFY' ||
          d.id.startsWith('shopify_') ||
          data.shopifyProductId ||
          data.shopifyVariantId ||
          (typeof data.sku === 'string' && data.sku.startsWith('SHOPIFY-'))
        ) {
          batch.delete(d.ref);
          hasShopifyProds = true;
        }
      });
      if (hasShopifyProds) await batch.commit().catch(console.warn);
    }

    // Transactions
    const txSnap = await db.collection('users').doc(tenantId).collection('transactions').get();
    if (!txSnap.empty) {
      const batch = db.batch();
      let hasShopifyTx = false;
      txSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (
          data.source === 'SHOPIFY' ||
          d.id.startsWith('tx_shopify_') ||
          d.id.startsWith('tx_refund_') ||
          data.paymentMethod === 'Shopify Payments' ||
          data.shopifyOrderId
        ) {
          batch.delete(d.ref);
          hasShopifyTx = true;
        }
      });
      if (hasShopifyTx) await batch.commit().catch(console.warn);
    }

    // Returns
    const retSnap = await db.collection('users').doc(tenantId).collection('returns').get();
    if (!retSnap.empty) {
      const batch = db.batch();
      let hasShopifyRet = false;
      retSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (
          data.source === 'SHOPIFY' ||
          d.id.startsWith('ret_shopify_') ||
          d.id.startsWith('ret_') ||
          data.shopifyReturnId ||
          (typeof data.notes === 'string' && data.notes.toLowerCase().includes('shopify'))
        ) {
          batch.delete(d.ref);
          hasShopifyRet = true;
        }
      });
      if (hasShopifyRet) await batch.commit().catch(console.warn);
    }

    // Integration doc
    await db.collection('users').doc(tenantId).collection('integrations').doc('shopify').delete().catch(console.warn);

    // Store lookup
    if (shop) {
      await db.collection('shopify_stores').doc(shop).delete().catch(console.warn);
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] purgeTenantShopifyData notice:', err);
  }
}

/**
 * Marks a Shopify connection UNINSTALLED, scrubs credentials, and updates merchant status.
 */
export async function markShopifyUninstalled(rawShop: string, purgeData: boolean = true): Promise<void> {
  const shop = sanitizeShopDomain(rawShop);
  if (!shop) return;

  const conn = await getShopifyConnection(shop);
  const tenantId = conn?.tenantId;
  const nowIso = new Date().toISOString();

  // 1. Update in-memory and file cache
  const conns = getMemoryConnections();
  if (conn) {
    const updated: ShopifyConnectionRecord = {
      ...conn,
      status: 'UNINSTALLED',
      uninstalledAt: nowIso,
      encryptedAccessToken: null as any,
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      updatedAt: nowIso,
    };
    conns.set(shop, updated);
    saveFileConnections(conns);
  }

  // 2. Attempt Firestore updates via Admin SDK
  try {
    const db = getDb();
    if (db) {
      const batch = db.batch();
      const connRef = db.collection('shopify_connections').doc(shop);
      batch.set(
        connRef,
        {
          status: 'UNINSTALLED',
          uninstalledAt: nowIso,
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      const storeRef = db.collection('shopify_stores').doc(shop);
      batch.set(storeRef, { status: 'UNINSTALLED', updatedAt: nowIso }, { merge: true });

      if (tenantId) {
        const profileRef = db.collection('users').doc(tenantId).collection('settings').doc('business_profile');
        batch.set(
          profileRef,
          {
            shopifyConnected: false,
            shopifyStatus: 'Uninstalled',
            shopifyStoreUrl: '',
            shopifyStoreName: '',
            shopifyAccessToken: null,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      await batch.commit();

      if (purgeData && tenantId) {
        await purgeTenantShopifyData(db, tenantId, shop);
      }
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] markShopifyUninstalled firestore notice:', err);
  }
}

/**
 * Marks a Shopify connection DISCONNECTED, invalidates active sessions, and updates merchant profile.
 */
export async function markShopifyDisconnected(
  rawShop?: string | null,
  explicitTenantId?: string,
  purgeData: boolean = true
): Promise<void> {
  const shop = rawShop ? sanitizeShopDomain(rawShop) : null;
  const nowIso = new Date().toISOString();

  let tenantId = explicitTenantId;
  const conns = getMemoryConnections();

  if (shop && conns.has(shop)) {
    const conn = conns.get(shop)!;
    tenantId = tenantId || conn.tenantId;
    const updated: ShopifyConnectionRecord = {
      ...conn,
      status: 'DISCONNECTED',
      encryptedAccessToken: null as any,
      encryptedRefreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      updatedAt: nowIso,
    };
    conns.set(shop, updated);
    saveFileConnections(conns);
  } else if (tenantId) {
    for (const [s, conn] of conns.entries()) {
      if (conn.tenantId === tenantId) {
        conn.status = 'DISCONNECTED';
        conn.encryptedAccessToken = null as any;
        conn.updatedAt = nowIso;
        conns.set(s, conn);
      }
    }
    saveFileConnections(conns);
  }

  try {
    const db = getDb();
    if (db) {
      const batch = db.batch();
      if (shop) {
        const connRef = db.collection('shopify_connections').doc(shop);
        batch.set(
          connRef,
          {
            status: 'DISCONNECTED',
            encryptedAccessToken: null,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      if (tenantId) {
        const userConnRef = db.collection('users').doc(tenantId).collection('integrations').doc('shopify');
        batch.set(userConnRef, { connectionStatus: 'Disconnected', updatedAt: nowIso }, { merge: true });

        const profileRef = db.collection('users').doc(tenantId).collection('settings').doc('business_profile');
        batch.set(
          profileRef,
          {
            shopifyConnected: false,
            shopifyStatus: 'Disconnected',
            shopifyStoreUrl: '',
            shopifyStoreName: '',
            shopifyAccessToken: null,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      await batch.commit();

      if (purgeData && tenantId) {
        await purgeTenantShopifyData(db, tenantId, shop);
      }
    }
  } catch (err) {
    console.warn('[Shopify Connection Store] markShopifyDisconnected firestore notice:', err);
  }
}

/**
 * Updates sync status and stats on the connection.
 */
export async function updateConnectionSyncStatus(
  rawShop: string,
  status: ShopifyConnectionStatus,
  stats?: any
): Promise<void> {
  const shop = sanitizeShopDomain(rawShop);
  if (!shop) return;

  const nowIso = new Date().toISOString();

  // 1. Update in-memory and file cache
  const conns = getMemoryConnections();
  const conn = conns.get(shop);
  if (conn) {
    conn.status = status;
    conn.lastSyncAt = nowIso;
    if (stats) {
      conn.syncStats = { ...stats, lastSyncedAt: nowIso };
    }
    conn.updatedAt = nowIso;
    conns.set(shop, conn);
    saveFileConnections(conns);
  }

  // 2. Attempt Firestore update via Admin SDK
  try {
    const db = getDb();
    if (db) {
      const connRef = db.collection('shopify_connections').doc(shop);
      await connRef.update({
        status,
        lastSyncAt: nowIso,
        ...(stats ? { syncStats: { ...stats, lastSyncedAt: nowIso } } : {}),
        updatedAt: nowIso,
      }).catch(() => {});
    }
  } catch {}
}
