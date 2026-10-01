import { describe, it, expect } from 'vitest';
import {
  classifyProductMovement,
  filterProductsByNaturalLanguage,
  type ProductMovementCategory,
} from './product-intelligence-engine';
import type { Product, Transaction } from './types';

describe('Product Movement Velocity Classification & Filtering', () => {
  const baseProduct: Product = {
    id: 'prod-1',
    name: 'Wireless Headphones',
    sku: 'WH-100',
    price: 2999,
    costPrice: 1500,
    stock: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('classifies a product with 0 sales as dead_stock when transactions are present', () => {
    const salesMap = new Map<string, number>();
    const movement = classifyProductMovement(baseProduct, salesMap, true);
    expect(movement).toBe('dead_stock');
  });

  it('classifies a product with high daily sales or units sold as fast_moving', () => {
    const fastProduct: Product = {
      ...baseProduct,
      id: 'prod-fast',
      averageDailySales: 2.5,
    };
    const salesMap = new Map<string, number>([['prod-fast', 45]]);
    const movement = classifyProductMovement(fastProduct, salesMap, true);
    expect(movement).toBe('fast_moving');
  });

  it('classifies a product with moderate or low sales volume as slow_moving', () => {
    const slowProduct: Product = {
      ...baseProduct,
      id: 'prod-slow',
      averageDailySales: 0.2,
    };
    const salesMap = new Map<string, number>([['prod-slow', 3]]);
    const movement = classifyProductMovement(slowProduct, salesMap, true);
    expect(movement).toBe('slow_moving');
  });

  it('correctly handles catalog evaluation when no sales transactions exist yet', () => {
    const deadCatProduct: Product = {
      ...baseProduct,
      id: 'prod-catalog-dead',
      averageDailySales: 0,
      salesVelocity: 0,
    };
    const fastCatProduct: Product = {
      ...baseProduct,
      id: 'prod-catalog-fast',
      averageDailySales: 1.5,
    };
    const slowCatProduct: Product = {
      ...baseProduct,
      id: 'prod-catalog-slow',
      averageDailySales: 0.4,
    };

    const emptyMap = new Map<string, number>();
    expect(classifyProductMovement(deadCatProduct, emptyMap, false)).toBe('dead_stock');
    expect(classifyProductMovement(fastCatProduct, emptyMap, false)).toBe('fast_moving');
    expect(classifyProductMovement(slowCatProduct, emptyMap, false)).toBe('slow_moving');
  });

  it('filters products by natural language query for slow moving items', () => {
    const products: Product[] = [
      { ...baseProduct, id: 'p1', name: 'Slow Mover Item', stock: 20, averageDailySales: 0.3 },
      { ...baseProduct, id: 'p2', name: 'Fast Trending Item', stock: 50, averageDailySales: 3.0 },
      { ...baseProduct, id: 'p3', name: 'Dead Stagnant Item', stock: 15, averageDailySales: 0 },
    ];

    const slowResults = filterProductsByNaturalLanguage(products, [], 'slow moving');
    expect(slowResults.map(p => p.id)).toContain('p1');
    expect(slowResults.map(p => p.id)).not.toContain('p3');
  });
});
