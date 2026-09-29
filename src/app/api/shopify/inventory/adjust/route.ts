import { NextRequest, NextResponse } from 'next/server';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { sanitizeShopDomain } from '@/lib/shopify/config';
import { getShopifyConnection } from '@/lib/shopify/connection-store';
import { adjustShopifyInventory, queryShopLocations } from '@/lib/shopify/admin-api';
import { recordOutgoingOperation, completeOutgoingOperation } from '@/lib/shopify/loop-prevention';
import { getAdminFirestore } from '@/lib/firebase/admin';

/**
 * POST /api/shopify/inventory/adjust
 * Handles inventory adjustment (e.g. from PO receiving) dispatched to Shopify Admin API.
 * Uses privileged Firebase Admin SDK for trusted persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveServerTenant(req);
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized: Valid AnalyzeUp session required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      shop: rawShop,
      inventoryItemId: rawInvItemId,
      locationId: rawLocId,
      delta,
      reason = 'received_purchase_order',
      receivingEventId,
      purchaseOrderId,
    } = body;

    const shop = sanitizeShopDomain(rawShop);
    if (!shop) {
      return NextResponse.json({ error: 'Invalid or missing shop parameter.' }, { status: 400 });
    }

    // Verify tenant ownership of this shop connection
    const connection = await getShopifyConnection(shop);
    if (!connection) {
      return NextResponse.json({ error: 'Shopify store not connected.' }, { status: 404 });
    }
    if (connection.tenantId && connection.tenantId !== tenant.tenantId) {
      return NextResponse.json({ error: 'Access denied: Store belongs to a different tenant.' }, { status: 403 });
    }

    const db = getAdminFirestore();

    // Auto-resolve locationId if omitted
    let cleanLocId = rawLocId ? String(rawLocId).replace('gid://shopify/Location/', '') : null;
    if (!cleanLocId) {
      if (connection.primaryLocationId) {
        cleanLocId = String(connection.primaryLocationId).replace('gid://shopify/Location/', '');
      } else {
        try {
          const locRes = await queryShopLocations(shop);
          if (locRes.primaryLocationId) {
            cleanLocId = String(locRes.primaryLocationId).replace('gid://shopify/Location/', '');
          }
        } catch (e) {
          console.warn('[Shopify Inventory Adjust] Failed to auto-resolve primary location:', e);
        }
      }
    }

    // Auto-resolve inventoryItemId if omitted
    let cleanInvItemId = rawInvItemId ? String(rawInvItemId).replace('gid://shopify/InventoryItem/', '') : null;
    if (!cleanInvItemId && db) {
      try {
        if (body.productId) {
          const prodDoc = await db.collection('users').doc(tenant.tenantId).collection('products').doc(String(body.productId)).get();
          if (prodDoc.exists) {
            const p = prodDoc.data();
            cleanInvItemId = p?.shopifyInventoryItemId || p?.inventoryItemId || (p?.variants?.[0]?.inventoryItemId) || null;
          }
        }
        if (!cleanInvItemId && body.sku) {
          const skuSnap = await db.collection('users').doc(tenant.tenantId).collection('products').where('sku', '==', String(body.sku)).limit(1).get();
          if (!skuSnap.empty) {
            const p = skuSnap.docs[0].data();
            cleanInvItemId = p?.shopifyInventoryItemId || p?.inventoryItemId || (p?.variants?.[0]?.inventoryItemId) || null;
          }
        }
      } catch (e) {
        console.warn('[Shopify Inventory Adjust] Failed to auto-resolve inventoryItemId:', e);
      }
    }

    if (!cleanInvItemId || !cleanLocId || typeof delta !== 'number' || delta === 0) {
      return NextResponse.json(
        { error: 'Missing required parameters: inventoryItemId, locationId, and non-zero numeric delta.' },
        { status: 400 }
      );
    }

    // 1. Duplicate receiving protection: Check if this receiving event was already processed
    if (receivingEventId && db) {
      const dedupRef = db.collection('shopify_processed_webhooks').doc(`rcv_${tenant.tenantId}_${receivingEventId}`);
      const dedupSnap = await dedupRef.get();
      if (dedupSnap.exists) {
        return NextResponse.json({
          success: true,
          message: 'Receiving event already processed previously.',
          deduplicated: true,
        });
      }
    }

    // 2. Register outgoing operation for loop prevention (avoids re-triggering mutation on incoming webhook)
    const resourceKey = `${cleanInvItemId}_${cleanLocId}`;
    const opId = await recordOutgoingOperation({
      tenantId: tenant.tenantId,
      shop,
      resourceType: 'INVENTORY',
      resourceId: resourceKey,
      mutationType: 'inventoryAdjustQuantities',
    });

    // 3. Dispatch GraphQL adjustment to Shopify Admin API (with 2026-07 idempotency mechanism)
    const result = await adjustShopifyInventory({
      shop,
      inventoryItemId: cleanInvItemId,
      locationId: cleanLocId,
      delta,
      reason,
      idempotencyKey: receivingEventId || `rcv_${cleanInvItemId}_${cleanLocId}_${Date.now()}`,
    });

    if (!result.success) {
      await completeOutgoingOperation(opId, 'FAILED');
      return NextResponse.json(
        {
          success: false,
          error: 'Shopify inventory adjustment failed.',
          userErrors: result.userErrors,
        },
        { status: 422 }
      );
    }

    await completeOutgoingOperation(opId, 'COMPLETED');

    // 4. Update multi-location inventory record under users/{tenantId}/inventory/{invItemId}_{locId}
    if (db) {
      const invDocRef = db.collection('users').doc(tenant.tenantId).collection('inventory').doc(resourceKey);
      const prevSnap = await invDocRef.get();
      const prevAvailable = prevSnap.exists ? (prevSnap.data()?.available || 0) : 0;
      const newAvailable = result.quantityAfterChange ?? (prevAvailable + delta);

      await invDocRef.set(
        {
          id: resourceKey,
          inventoryItemId: cleanInvItemId,
          locationId: cleanLocId,
          available: newAvailable,
          tenantId: tenant.tenantId,
          shop,
          lastAdjustedDelta: delta,
          lastAdjustReason: reason,
          purchaseOrderId: purchaseOrderId || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Record deduplication marker for this receiving event
      if (receivingEventId) {
        const dedupRef = db.collection('shopify_processed_webhooks').doc(`rcv_${tenant.tenantId}_${receivingEventId}`);
        await dedupRef.set({
          receivingEventId,
          purchaseOrderId: purchaseOrderId || null,
          processedAt: new Date().toISOString(),
        }).catch(console.warn);
      }
    }

    return NextResponse.json({
      success: true,
      quantityAfterChange: result.quantityAfterChange,
      inventoryItemId: cleanInvItemId,
      locationId: cleanLocId,
      delta,
    });
  } catch (error: any) {
    console.error('[Shopify Inventory Adjust Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Inventory adjustment failed.' },
      { status: 500 }
    );
  }
}
