import { describe, it, expect } from 'vitest';
import {
  convertShopifyToCanonicalProducts,
  convertShopifyToCanonicalTransactions,
} from '@/lib/ingestion/shopify-adapter';

describe('Shopify Account, Company Name & Image Linking Suite', () => {
  it('stores companyName, storeName, and shopDomain when converting Shopify products with images', () => {
    const mockRawProducts = [
      {
        id: 778899,
        title: 'Air Max Runner',
        product_type: 'Footwear',
        vendor: 'Nike Athletics',
        image: { src: 'https://cdn.shopify.com/s/files/1/0001/products/runner.jpg' },
        images: [{ id: 11, src: 'https://cdn.shopify.com/s/files/1/0001/products/runner.jpg' }],
        variants: [
          {
            id: 101,
            title: 'Size 10 / Red',
            price: '4999.00',
            sku: 'AM-RD-10',
            inventory_quantity: 45,
            image_id: 11,
          },
        ],
      },
    ];

    const canonicalProducts = convertShopifyToCanonicalProducts(mockRawProducts, {
      shop: 'snkhed.myshopify.com',
      storeName: 'SNKHED',
      companyName: 'SNKHED',
    });

    expect(canonicalProducts).toHaveLength(1);
    const prod = canonicalProducts[0];

    // Image is preserved
    expect(prod.imageUrl).toBe('https://cdn.shopify.com/s/files/1/0001/products/runner.jpg');

    // Company and store links are explicitly saved
    expect(prod.companyName).toBe('SNKHED');
    expect(prod.storeName).toBe('SNKHED');
    expect(prod.shopDomain).toBe('snkhed.myshopify.com');
    expect(prod.source).toBe('SHOPIFY');
    expect(prod.importSource).toBe('shopify');
  });

  it('falls back gracefully to shop prefix if companyName/storeName not explicitly passed', () => {
    const mockRawProducts = [
      {
        id: 12345,
        title: 'Minimalist Mug',
        product_type: 'Kitchen',
        vendor: 'Ceramics Co',
        images: [{ id: 22, src: 'https://cdn.shopify.com/mug.jpg' }],
        variants: [
          {
            id: 202,
            title: 'Default Title',
            price: '499.00',
            sku: 'MUG-01',
            inventory_quantity: 120,
          },
        ],
      },
    ];

    const canonicalProducts = convertShopifyToCanonicalProducts(mockRawProducts, {
      shop: 'artisan-goods.myshopify.com',
    });

    expect(canonicalProducts).toHaveLength(1);
    const prod = canonicalProducts[0];
    expect(prod.imageUrl).toBe('https://cdn.shopify.com/mug.jpg');
    expect(prod.companyName).toBe('artisan-goods');
    expect(prod.storeName).toBe('artisan-goods');
    expect(prod.shopDomain).toBe('artisan-goods.myshopify.com');
  });

  it('stores companyName, storeName, and shopDomain when converting Shopify transactions', () => {
    const mockRawOrders = [
      {
        id: 998877,
        name: '#SNK-1001',
        created_at: '2026-09-29T10:00:00Z',
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        total_price: '4999.00',
        customer: { first_name: 'Dhruv', last_name: 'Sharma' },
        line_items: [
          {
            id: 5544,
            title: 'Air Max Runner (Size 10 / Red)',
            price: '4999.00',
            quantity: 1,
            sku: 'AM-RD-10',
            product_id: 778899,
            variant_id: 101,
          },
        ],
      },
    ];

    const canonicalTransactions = convertShopifyToCanonicalTransactions(mockRawOrders, {
      shop: 'snkhed.myshopify.com',
      storeName: 'SNKHED',
      companyName: 'SNKHED',
    });

    expect(canonicalTransactions).toHaveLength(1);
    const tx = canonicalTransactions[0];
    expect(tx.companyName).toBe('SNKHED');
    expect(tx.storeName).toBe('SNKHED');
    expect(tx.shopDomain).toBe('snkhed.myshopify.com');
    expect(tx.source).toBe('SHOPIFY');
    expect(tx.customerName).toBe('Dhruv Sharma');
    expect(tx.price).toBe(4999);
  });
});
