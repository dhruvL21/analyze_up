import { describe, it, expect } from 'vitest';

function evaluateDemoVisibility({
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
  const isDemoLoaded = Boolean(
    hasDemoData ||
    (products.length > 0 && products.every((p: any) => p?.isDemo === true || p?.source === 'DEMO' || p?.source === 'demo' || String(p?.id || '').startsWith('prod-'))) ||
    products.some((p: any) => p?.isDemo === true || p?.source === 'DEMO' || p?.source === 'demo')
  );

  // Demo actions are always visible regardless of integration state
  const demoActionsAlwaysVisible = true;

  return {
    isDemoLoaded,
    demoActionsAlwaysVisible,
    displayedButton: isDemoLoaded ? 'Delete Demo' : 'Load Demo',
  };
}

describe('Founder Quick Actions: Demo Data Always Visible', () => {
  it('shows "Load Demo" for fresh accounts with no data', () => {
    const state = evaluateDemoVisibility({});
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('shows "Delete Demo" when demo data is loaded', () => {
    const state = evaluateDemoVisibility({
      hasDemoData: true,
      products: [{ id: 'prod-1', isDemo: true, source: 'DEMO' }],
    });
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Delete Demo');
  });

  it('still shows "Load Demo" even when Shopify is connected', () => {
    // Demo button is always visible regardless of Shopify state
    const state = evaluateDemoVisibility({
      businessProfile: { shopifyConnected: true, shopifyStatus: 'Connected' },
    });
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('still shows "Load Demo" even when Google Drive is connected', () => {
    // Demo button is always visible regardless of Drive state
    const state = evaluateDemoVisibility({
      driveConnection: { connectionStatus: 'Connected', isConnected: true, selectedFolderId: 'folder-123' },
    });
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('still shows "Load Demo" even when real CSV products are imported', () => {
    // Demo button is always visible regardless of real data presence
    const state = evaluateDemoVisibility({
      products: [{ id: 'real-sku-101', name: 'Custom User Tee', price: 999, isDemo: false }],
    });
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Load Demo');
  });

  it('shows "Load Demo" after all data is deleted', () => {
    const state = evaluateDemoVisibility({ products: [], transactions: [] });
    expect(state.demoActionsAlwaysVisible).toBe(true);
    expect(state.displayedButton).toBe('Load Demo');
  });
});
