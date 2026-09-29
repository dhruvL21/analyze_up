import { describe, it, expect } from 'vitest';
import { getRecommendationChannel } from './inventory-recommendations-panel';
import Papa from 'papaparse';

describe('Source-Aware Inventory Recommendation Channel Suite', () => {
  it('correctly routes products to SHOPIFY channel when Shopify is connected', () => {
    const prod = { id: 'p1', name: 'Sneakers', stock: 2, price: 1200 };
    const businessProfile = { shopifyConnected: true, shopifyStoreUrl: 'demo.myshopify.com' };
    const driveConnection = null;

    expect(getRecommendationChannel(prod, businessProfile, driveConnection)).toBe('SHOPIFY');
  });

  it('routes to SHOPIFY when product has shopifyProductId or source is SHOPIFY', () => {
    const prod = { id: 'p2', name: 'Boots', stock: 0, price: 2000, shopifyProductId: 'gid://shopify/Product/123' };
    const businessProfile = { shopifyConnected: false };
    const driveConnection = { isConnected: true };

    // Explicit Shopify product takes precedence
    expect(getRecommendationChannel(prod, businessProfile, driveConnection)).toBe('SHOPIFY');
  });

  it('correctly routes products to GOOGLE_DRIVE when Google Drive is connected', () => {
    const prod = { id: 'p3', name: 'Leather Bag', stock: 4, price: 3500, source: 'GOOGLE_DRIVE' };
    const businessProfile = { shopifyConnected: false };
    const driveConnection = { isConnected: true, connectionStatus: 'Connected' };

    expect(getRecommendationChannel(prod, businessProfile, driveConnection)).toBe('GOOGLE_DRIVE');
  });

  it('routes to GOOGLE_DRIVE when driveConnection is active even if product source is generic', () => {
    const prod = { id: 'p4', name: 'Running Tee', stock: 1, price: 600 };
    const businessProfile = { shopifyConnected: false };
    const driveConnection = { isConnected: true, connectionStatus: 'Connected', selectedFolderId: 'folder_abc' };

    expect(getRecommendationChannel(prod, businessProfile, driveConnection)).toBe('GOOGLE_DRIVE');
  });

  it('routes to LOCAL when neither Shopify nor Google Drive is active', () => {
    const prod = { id: 'p5', name: 'Wallet', stock: 3, price: 400 };
    const businessProfile = { shopifyConnected: false };
    const driveConnection = { isConnected: false, connectionStatus: 'Disconnected' };

    expect(getRecommendationChannel(prod, businessProfile, driveConnection)).toBe('LOCAL');
  });

  it('correctly modifies Drive CSV rows in memory matching SKU and product name', () => {
    const originalCsv = `SKU,Product Name,Stock,Price,Compare At Price
SNK-01,SNKHED Streetform 16 (8),0,500,600
TSH-02,Cotton Oversized Tee,25,350,400`;

    const parsed = Papa.parse<Record<string, string>>(originalCsv, { header: true });
    expect(parsed.data.length).toBe(2);

    // Apply Reorder update (+50 stock)
    const update = {
      sku: 'SNK-01',
      productName: 'SNKHED Streetform 16 (8)',
      newStock: 50,
      newPrice: 540,
    };

    const targetRow = parsed.data.find(
      r => r.SKU === update.sku || r['Product Name'] === update.productName
    );
    expect(targetRow).toBeDefined();

    if (targetRow) {
      targetRow.Stock = String(update.newStock);
      targetRow.Price = String(update.newPrice);
    }

    const updatedCsv = Papa.unparse(parsed.data, { quotes: true, header: true });
    expect(updatedCsv).toContain('"50"');
    expect(updatedCsv).toContain('"540"');
    expect(updatedCsv).toContain('"Cotton Oversized Tee"');
  });
});
