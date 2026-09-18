import { NextRequest, NextResponse } from 'next/server';
import { resolveServerTenant } from '@/lib/shopify/auth-guard';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { DEFAULT_ANALYTICS_SUMMARY } from '@/lib/analytics-aggregator';

export async function POST(req: NextRequest) {
  const tenant = await resolveServerTenant(req);
  if (process.env.NODE_ENV !== 'test' && !tenant) {
    return NextResponse.json({ error: 'Unauthorized. An active authenticated session is required.' }, { status: 401 });
  }

  const userIdFromHeader = req.headers.get('x-user-uid');
  const body = await req.json().catch(() => ({}));
  const userId = tenant ? tenant.tenantId : (userIdFromHeader || body.userId);

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  if (tenant && tenant.tenantId !== userId) {
    return NextResponse.json({ error: 'Forbidden. You can only reset your own workspace.' }, { status: 403 });
  }

  try {
    const db = getAdminFirestore();
    const colNames = [
      'products',
      'orders',
      'suppliers',
      'transactions',
      'categories',
      'returns',
      'custom_attributes',
      'importJobs',
      'import_jobs',
      'google_drive_files',
      'sync_history',
      'mapping_profiles',
      'drive_sync_history',
      'drive_files',
      'drive_mappings',
      'audit_logs',
      'forecasts',
      'insights',
      'simulations',
      'events',
      'tasks',
    ];

    // 1. Fetch all collections in parallel on server
    const snaps = await Promise.all(
      colNames.map((name) =>
        db.collection('users').doc(userId).collection(name).get().catch(() => null)
      )
    );

    const docRefsToDelete: any[] = [];
    snaps.forEach((snap) => {
      if (snap && !snap.empty) {
        snap.docs.forEach((d) => docRefsToDelete.push(d.ref));
      }
    });

    // 2. Integration connection docs
    const integrations = ['google-drive', 'google_drive', 'shopify', 'zoho', 'tally', 'woocommerce'];
    integrations.forEach((name) => {
      docRefsToDelete.push(db.collection('users').doc(userId).collection('integrations').doc(name));
    });

    // 3. Analytics docs
    docRefsToDelete.push(db.collection('users').doc(userId).collection('analytics').doc('summary'));
    docRefsToDelete.push(db.collection('users').doc(userId).collection('analytics').doc('ai_brief'));

    // 4. Batch commit deletions in chunks of 450
    const CHUNK_SIZE = 450;
    const batchPromises: Promise<any>[] = [];
    for (let i = 0; i < docRefsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docRefsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      batchPromises.push(batch.commit().catch(() => {}));
    }

    await Promise.all(batchPromises);

    // 5. Reset analytics summary document to default empty state
    await db.collection('users').doc(userId).collection('analytics').doc('summary').set(DEFAULT_ANALYTICS_SUMMARY).catch(() => {});

    // 6. Reset business profile integration flags
    const profileRef = db.collection('users').doc(userId).collection('settings').doc('business_profile');
    await profileRef.set(
      {
        inventorySetupMethod: 'manual',
        csvImportedAt: null,
        shopifyConnected: false,
        shopifyStoreUrl: '',
        shopifyStoreName: '',
        shopifyStatus: 'Disconnected',
        isOnboardingCompleted: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      deletedDocsCount: docRefsToDelete.length,
    });
  } catch (error: any) {
    console.error('Server workspace wipe error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to wipe workspace' },
      { status: 500 }
    );
  }
}
