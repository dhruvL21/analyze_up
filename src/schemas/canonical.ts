/**
 * Canonical AnalyzeUp Schema (analyzeup_v1)
 * Standardized data models representing normalized business entities.
 */
import { z } from 'zod';

export const CanonicalProductSchema = z.object({
  product_id: z.string().default(''),
  product_name: z.string().min(1, 'Product name is required'),
  sku: z.string().default(''),
  category: z.string().default('General'),
  inventory_quantity: z.number().nonnegative().default(0),
  min_stock: z.number().nonnegative().default(5),
  max_stock: z.number().nonnegative().default(100),
  price: z.number().nonnegative().default(0),
  cost_price: z.number().nonnegative().default(0),
  supplier_name: z.string().default(''),
  supplier_id: z.string().default(''),
  lead_time_days: z.number().positive().default(7),
  unit: z.string().default('Piece'),
  brand: z.string().default(''),
  barcode: z.string().default(''),
  description: z.string().default(''),
  custom_attributes: z.record(z.any()).optional().default({}),
  raw_attributes: z.record(z.any()).optional().default({}),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString()),
});

export type CanonicalProduct = Omit<z.infer<typeof CanonicalProductSchema>, 'custom_attributes' | 'raw_attributes'> & {
  custom_attributes?: Record<string, any>;
  raw_attributes?: Record<string, any>;
};

export const CanonicalSaleSchema = z.object({
  sale_id: z.string().default(''),
  order_number: z.string().default(''),
  product_id: z.string().default(''),
  product_name: z.string().default(''),
  sku: z.string().default(''),
  category: z.string().default('General'),
  units_sold: z.number().positive().default(1),
  selling_price: z.number().nonnegative().default(0),
  cost_per_unit: z.number().nonnegative().default(0),
  revenue: z.number().nonnegative().default(0),
  total_cost: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  customer_name: z.string().default('Retail Customer'),
  supplier_name: z.string().default(''),
  sale_date: z.string().default(() => new Date().toISOString().split('T')[0]),
  payment_method: z.string().default('UPI'),
  status: z.string().default('Completed'),
  custom_attributes: z.record(z.any()).optional().default({}),
  raw_attributes: z.record(z.any()).optional().default({}),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type CanonicalSale = Omit<z.infer<typeof CanonicalSaleSchema>, 'custom_attributes' | 'raw_attributes' | 'discount' | 'tax'> & {
  custom_attributes?: Record<string, any>;
  raw_attributes?: Record<string, any>;
  discount?: number;
  tax?: number;
};

export const CanonicalSupplierSchema = z.object({
  supplier_id: z.string().default(''),
  supplier_name: z.string().min(1, 'Supplier name is required'),
  contact_name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  address: z.string().default(''),
  category: z.string().default('General'),
  lead_time_days: z.number().positive().default(7),
  rating: z.number().min(0).max(5).default(4.5),
  performance_score: z.number().min(0).max(100).default(85),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString()),
});

export type CanonicalSupplier = z.infer<typeof CanonicalSupplierSchema>;

export const CanonicalPurchaseOrderSchema = z.object({
  order_id: z.string().default(''),
  supplier_id: z.string().default(''),
  supplier_name: z.string().default(''),
  product_id: z.string().default(''),
  product_name: z.string().default(''),
  quantity: z.number().positive().default(1),
  unit_cost: z.number().nonnegative().default(0),
  total_amount: z.number().nonnegative().default(0),
  order_date: z.string().default(() => new Date().toISOString()),
  expected_delivery_date: z.string().default(() => new Date().toISOString()),
  status: z.enum(['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Fulfilled']).default('Pending'),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString()),
});

export type CanonicalPurchaseOrder = z.infer<typeof CanonicalPurchaseOrderSchema>;

export const CanonicalReturnSchema = z.object({
  return_id: z.string().default(''),
  product_id: z.string().default(''),
  product_name: z.string().default(''),
  sku: z.string().default(''),
  category: z.string().default('General'),
  quantity: z.number().positive().default(1),
  return_reason: z.string().default('Defective'),
  return_date: z.string().default(() => new Date().toISOString()),
  refund_amount: z.number().nonnegative().default(0),
  refund_status: z.enum(['Pending', 'Approved', 'Rejected', 'Refunded']).default('Approved'),
  condition: z.enum(['Damaged', 'Defective', 'Unopened', 'Opened']).default('Opened'),
  disposition: z.enum(['Restock', 'Scrap', 'Return to Supplier']).default('Restock'),
  created_at: z.string().default(() => new Date().toISOString()),
});

export type CanonicalReturn = z.infer<typeof CanonicalReturnSchema>;

export const CanonicalDatasetSchema = z.object({
  schema_version: z.literal('analyzeup_v1').default('analyzeup_v1'),
  imported_at: z.string().default(() => new Date().toISOString()),
  source_type: z.enum(['CSV', 'EXCEL', 'GOOGLE_DRIVE', 'SHOPIFY', 'DATABASE', 'MANUAL']),
  source_name: z.string().default('data-import'),
  products: z.array(CanonicalProductSchema).default([]),
  sales: z.array(CanonicalSaleSchema).default([]),
  suppliers: z.array(CanonicalSupplierSchema).default([]),
  orders: z.array(CanonicalPurchaseOrderSchema).default([]),
  returns: z.array(CanonicalReturnSchema).default([]),
});

export type CanonicalDataset = z.infer<typeof CanonicalDatasetSchema>;
