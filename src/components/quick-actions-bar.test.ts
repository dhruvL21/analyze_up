import { describe, it, expect } from 'vitest';

function evaluateDemoVisibility({
  businessProfile,
  driveConnection,
  products = [],
  transactions = [],
  hasDemoData = false,
}: {
  businessProfile?: any;
  driveConnection?: any;
  products?: any[];
  transactions?: any[];
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
    (products.length > 0 && products.every((p: any) => p?.isDemo === true || p?.source === 'DEMO' || p?.source === 'demo' || String(p?.id || '').startsWith('prod-'))) ||
    products.some((p: any) => p?.isDemo === true || p?.source === 'DEMO' || p?.source === 'demo')
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

  const hasRealNonDemoData = (products.length > 0 || transactions.length > 0) && !isDemoLoaded;
  const hasRealCatalog = hasRealProd || hasRealTx || hasRealNonDemoData;

  const shouldHideDemoActions = isShopifyConnected || isDriveConnected || hasRealCatalog;

  return {
    isShopifyConnected,
    isDriveConnected,
    isDemoLoaded,
    hasRealCatalog,
    shouldHideDemoActions,
    displayedButton: shouldHideDemoActions ? null : isDemoLoaded ? 'Delete Demo' : 'Load Demo',
  };
}

describe('Founder Quick Actions: Dynamic Load Demo Lifecycle', () => {
  it('shows "Load Demo" for fresh accounts with no integrations or data', () => {
    const state = evaluateDemoVisibility({});
    expect(state.shouldHideDemoActions).toBe(false);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('shows "Delete Demo" when demo data is loaded', () => {
    const state = evaluateDemoVisibility({
      hasDemoData: true,
      products: [{ id: 'prod-1', isDemo: true, source: 'DEMO' }],
    });
    expect(state.shouldHideDemoActions).toBe(false);
    expect(state.displayedButton).toBe('Delete Demo');
  });

  it('immediately hides Load Demo when Shopify is connected, and restores it when disconnected', () => {
    // 1. Shopify Connected
    const connectedState = evaluateDemoVisibility({
      businessProfile: { shopifyConnected: true, shopifyStatus: 'Connected', shopifyStoreUrl: 'snkhed.myshopify.com' },
    });
    expect(connectedState.shouldHideDemoActions).toBe(true);
    expect(connectedState.displayedButton).toBe(null);

    // 2. Shopify Disconnected
    const disconnectedState = evaluateDemoVisibility({
      businessProfile: { shopifyConnected: false, shopifyStatus: 'Disconnected' },
    });
    expect(disconnectedState.shouldHideDemoActions).toBe(false);
    expect(disconnectedState.displayedButton).toBe('Load Demo');
  });

  it('immediately hides Load Demo when Google Drive is connected, and restores it when disconnected', () => {
    // 1. Drive Connected
    const connectedState = evaluateDemoVisibility({
      driveConnection: { connectionStatus: 'Connected', isConnected: true, selectedFolderId: 'folder-123' },
    });
    expect(connectedState.shouldHideDemoActions).toBe(true);
    expect(connectedState.displayedButton).toBe(null);

    // 2. Drive Disconnected
    const disconnectedState = evaluateDemoVisibility({
      driveConnection: { connectionStatus: 'Disconnected', isConnected: false },
    });
    expect(disconnectedState.shouldHideDemoActions).toBe(false);
    expect(disconnectedState.displayedButton).toBe('Load Demo');
  });

  it('immediately hides Load Demo when CSV products/data are imported, and restores it when deleted', () => {
    // 1. Real CSV Products Imported
    const importedState = evaluateDemoVisibility({
      products: [{ id: 'real-sku-101', name: 'Custom User Tee', price: 999, isDemo: false }],
    });
    expect(importedState.shouldHideDemoActions).toBe(true);
    expect(importedState.displayedButton).toBe(null);

    // 2. User deletes all products/data
    const deletedState = evaluateDemoVisibility({
      products: [],
      transactions: [],
    });
    expect(deletedState.shouldHideDemoActions).toBe(false);
    expect(deletedState.displayedButton).toBe('Load Demo');
  });
});
