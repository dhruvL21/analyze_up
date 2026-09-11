import { describe, it, expect } from 'vitest';
import { getSmartMappingForFileType } from './import-engine';
import { normalizeToSales, normalizeToProducts, findFallbackProductName, findFallbackPrice } from '@/lib/ingestion/data-validator';
import { evaluateDataQuality, evaluateDataReadiness } from '@/lib/data-readiness-engine';

describe('Dynamic Mapper Collision Prevention & Database Attribute Preservation', () => {
  it('correctly maps product name and price even when CSV has discount columns like "Item Discount" and "Discount Amount"', async () => {
    const rawHeaders = ['Order ID', 'Item Name', 'Item Discount', 'Price', 'Discount Amount', 'Date', 'Qty'];
    const rawRows = [
      {
        'Order ID': 'ORD-101',
        'Item Name': 'Premium Ergonomic Office Chair',
        'Item Discount': '0.00',
        'Price': '12499.00',
        'Discount Amount': '0.00',
        'Date': '2026-03-01',
        'Qty': '2',
      },
      {
        'Order ID': 'ORD-102',
        'Item Name': 'Wireless Mechanical Keyboard',
        'Item Discount': '150.00',
        'Price': '4500.00',
        'Discount Amount': '150.00',
        'Date': '2026-03-02',
        'Qty': '1',
      },
    ];

    const result = await getSmartMappingForFileType('SALES_REPORT', rawHeaders, rawRows);
    const mapping = result.mapping;

    // Item Name must be productName
    expect(mapping['Item Name']).toBe('productName');
    // Item Discount must NOT be productName
    expect(mapping['Item Discount']).not.toBe('productName');
    // Price must be sellingPrice
    expect(mapping['Price']).toBe('sellingPrice');
    // Discount Amount must NOT be sellingPrice
    expect(mapping['Discount Amount']).not.toBe('sellingPrice');
  });

  it('normalizes sales records and safely retains raw attributes and custom attributes', () => {
    const rawHeaders = ['Order ID', 'Item Name', 'Item Discount', 'Price', 'Custom Warehouse', 'Batch Tag'];
    const rawRows = [
      {
        'Order ID': 'INV-9901',
        'Item Name': 'Logitech MX Master 3S',
        'Item Discount': '0.00',
        'Price': '8999',
        'Custom Warehouse': 'Mumbai Hub 4',
        'Batch Tag': 'Q1-PROMO',
      },
    ];

    const mapping = {
      'Order ID': 'orderNumber',
      'Item Name': 'productName',
      'Item Discount': 'discount',
      'Price': 'sellingPrice',
      'Custom Warehouse': 'customAttribute',
      'Batch Tag': 'customAttribute',
    };

    const norm = normalizeToSales(rawRows, mapping);
    expect(norm.errorRecords.length).toBe(0);
    expect(norm.validRecords.length).toBe(1);

    const sale = norm.validRecords[0];
    expect(sale.product_name).toBe('Logitech MX Master 3S');
    expect(sale.selling_price).toBe(8999);
    expect(sale.order_number).toBe('INV-9901');

    // Verify all extra/raw attributes are preserved for database storage
    expect(sale.raw_attributes).toBeDefined();
    expect(sale.raw_attributes!['Custom Warehouse']).toBe('Mumbai Hub 4');
    expect(sale.raw_attributes!['Batch Tag']).toBe('Q1-PROMO');
  });

  it('detects and recovers product name and price via fallback helpers if headers were mismatched', () => {
    const badRow = {
      'Order ID': 'INV-555',
      'Some Code': 'SKU-999',
      'Actual Product Title': 'Noise Cancelling Headphones',
      'Discount Amt': '0.00',
      'Unit Price': '3499.00',
    };

    const fallbackName = findFallbackProductName(badRow);
    expect(fallbackName).toBe('Noise Cancelling Headphones');

    const fallbackPrice = findFallbackPrice(badRow);
    expect(fallbackPrice).toBe(3499);
  });

  it('ensures zero-data state produces authentic 0 readiness scores and 0 day/order counts', () => {
    const quality = evaluateDataQuality([], []);
    expect(quality.score).toBe(0);
    expect(quality.percentage).toBe(0);
    expect(quality.totalRecordsChecked).toBe(0);

    const readiness = evaluateDataReadiness([], []);
    expect(readiness.score).toBe(0);
    expect(readiness.historicalDays).toBe(0);
    expect(readiness.totalOrders).toBe(0);
    expect(readiness.level).toBe('LEARNING');
  });
});
