import { describe, it, expect } from 'vitest';

function evaluateDemoVisibility({
  businessProfile,
  driveConnection,
  products = [],
  transactions = [],
  suppliers = [],
  orders = [],
  hasDemoData = false,
}: {
  businessProfile?: any;
  driveConnection?: any;
  products?: any[];
  transactions?: any[];
  suppliers?: any[];
  orders?: any[];
  hasDemoData?: boolean;
}) {
  const isShopifyConnected = Boolean(
    (businessProfile?.shopifyConnected === true || businessProfile?.shopifyStatus === 'Connected') ||
    (Boolean(businessProfile?.shopifyStoreUrl) && businessProfile?.shopifyConnected !== false && businessProfile?.shopifyStatus !== 'Disconnected')
  );

  const isDriveConnected = Boolean(
    driveConnection &&
    (driveConnection.connectionStatus === 'Connected' || driveConnection.isConnected === true || Boolean(driveConnection.selectedFolderId)) &&
    driveConnection.connectionStatus !== 'Disconnected'
  );

  const isDemoLoaded = Boolean(
    hasDemoData ||
    (products.length > 0 && products.some((p: any) =>
      p?.isDemo === true ||
      p?.source === 'DEMO' ||
      p?.source === 'demo' ||
      /^prod-\d+$/.test(String(p?.id || '')) ||
      String(p?.id || '').startsWith('prod-fashion-') ||
      String(p?.id || '').startsWith('prod-electronics-') ||
      String(p?.id || '').startsWith('prod-beauty-') ||
      String(p?.id || '').startsWith('prod-home-') ||
      String(p?.id || '').startsWith('prod-sports-') ||
      String(p?.id || '').startsWith('prod-food-')
    )) ||
    (transactions.length > 0 && transactions.some((t: any) =>
      t?.isDemo === true ||
      t?.source === 'DEMO' ||
      t?.source === 'demo' ||
      /^tx-\d+$/.test(String(t?.id || ''))
    )) ||
    (suppliers.length > 0 && suppliers.some((s: any) =>
      s?.isDemo === true ||
      s?.source === 'DEMO' ||
      s?.source === 'demo' ||
      /^sup-\d+$/.test(String(s?.id || ''))
    ))
  );

  const hasRealProd = products.some((p: any) => {
    if (!p) return false;
    if (p.isDemo === true || p.source === 'DEMO' || p.source === 'demo') return false;
    const pid = String(p.id || '');
    if (
      /^prod-\d+$/.test(pid) ||
      pid.startsWith('demo_') ||
      pid.startsWith('prod-fashion-') ||
      pid.startsWith('prod-electronics-') ||
      pid.startsWith('prod-home-') ||
      pid.startsWith('prod-beauty-') ||
      pid.startsWith('prod-sports-') ||
      pid.startsWith('prod-food-')
    ) return false;
    return true;
  });

  const hasRealTx = transactions.some((t: any) => {
    if (!t) return false;
    if (t.isDemo === true || t.source === 'DEMO' || t.source === 'demo') return false;
    const tid = String(t.id || '');
    if (tid.startsWith('tx-') || tid.startsWith('tx_demo_') || tid.startsWith('demo_')) return false;
    return true;
  });

  const hasRealSuppliers = suppliers.some((s: any) => {
    if (!s) return false;
    if (s.isDemo === true || s.source === 'DEMO' || s.source === 'demo') return false;
    const sid = String(s.id || '');
    if (sid.startsWith('demo_') || sid.startsWith('sup-') || sid.startsWith('sup-demo')) return false;
    return true;
  });

  const hasRealOrders = orders.some((o: any) => {
    if (!o) return false;
    if (o.isDemo === true || o.source === 'DEMO' || o.source === 'demo') return false;
    const oid = String(o.id || '');
    if (oid.startsWith('demo_') || oid.startsWith('order-demo') || oid.startsWith('ord-') || oid.startsWith('po-')) return false;
    return true;
  });

  const hasRealCatalog = hasRealProd || hasRealTx || hasRealSuppliers || hasRealOrders;
  const shouldHideDemoActions = isShopifyConnected || isDriveConnected || hasRealCatalog;

  return {
    isDemoLoaded,
    shouldHideDemoActions,
    displayedButton: isDemoLoaded ? 'Delete Demo' : (!shouldHideDemoActions ? 'Load Demo' : null),
  };
}

describe('Founder Quick Actions: Dynamic Demo Data Visibility', () => {
  it('shows "Load Demo" for fresh accounts with no data', () => {
    const state = evaluateDemoVisibility({});
    expect(state.shouldHideDemoActions).toBe(false);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('shows "Delete Demo" when demo data is loaded with demo products, suppliers, and orders', () => {
    const state = evaluateDemoVisibility({
      hasDemoData: true,
      products: [{ id: 'prod-1', isDemo: true, source: 'DEMO' }],
      suppliers: [{ id: 'sup-1', isDemo: true, source: 'DEMO' }],
      orders: [{ id: 'ord-123', isDemo: true, source: 'DEMO' }],
    });
    expect(state.isDemoLoaded).toBe(true);
    expect(state.displayedButton).toBe('Delete Demo');
  });

  it('shows "Delete Demo" even if demo suppliers have sup-1 id format without sup-demo prefix', () => {
    const state = evaluateDemoVisibility({
      products: [{ id: 'prod-10', name: 'Heavyweight Fleece Oversized Hoodie', isDemo: true, source: 'DEMO' }],
      suppliers: [{ id: 'sup-1', name: 'Apex Apparel Global' }],
    });
    expect(state.isDemoLoaded).toBe(true);
    expect(state.displayedButton).toBe('Delete Demo');
  });

  it('automatically hides "Load Demo" when real products are imported or added', () => {
    const state = evaluateDemoVisibility({
      products: [{ id: 'real-sku-101', name: 'Custom User Tee', price: 999, isDemo: false }],
    });
    expect(state.shouldHideDemoActions).toBe(true);
    expect(state.displayedButton).toBeNull();
  });

  it('automatically hides "Load Demo" when Shopify is connected', () => {
    const state = evaluateDemoVisibility({
      businessProfile: { shopifyConnected: true, shopifyStatus: 'Connected', shopifyStoreUrl: 'https://store.myshopify.com' },
    });
    expect(state.shouldHideDemoActions).toBe(true);
    expect(state.displayedButton).toBeNull();
  });

  it('automatically hides "Load Demo" when Google Drive is connected', () => {
    const state = evaluateDemoVisibility({
      driveConnection: { connectionStatus: 'Connected', isConnected: true, selectedFolderId: 'folder-123' },
    });
    expect(state.shouldHideDemoActions).toBe(true);
    expect(state.displayedButton).toBeNull();
  });

  it('re-shows "Load Demo" after all data is removed / workspace is cleared', () => {
    const state = evaluateDemoVisibility({ products: [], transactions: [], suppliers: [], orders: [] });
    expect(state.shouldHideDemoActions).toBe(false);
    expect(state.displayedButton).toBe('Load Demo');
  });
});
