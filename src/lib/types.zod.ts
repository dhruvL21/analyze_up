
import { z } from 'zod';

// Base schema for document ID
const DocumentIdSchema = z.string().min(1, { message: "ID is required." });

// Zod schema for Product
export const ProductSchema = z.object({
  id: DocumentIdSchema,
  name: z.string().min(1, { message: "Product name is required." }),
  description: z.string().optional(),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  stock: z.number().min(0, { message: "Stock cannot be negative." }),
  price: z.number().min(0, { message: "Price cannot be negative." }),
  imageUrl: z.string().url({ message: "Invalid URL format." }).optional(),
  supplierId: z.string().optional(),
  averageDailySales: z.number().min(0).optional(),
  leadTimeDays: z.number().min(0).optional(),
  userId: z.string().optional(),
});

// Zod schema for Category
export const CategorySchema = z.object({
  id: DocumentIdSchema,
  name: z.string().min(1, { message: "Category name is required." }),
  description: z.string().optional(),
  userId: z.string().optional(),
});

// Zod schema for Transaction
export const TransactionSchema = z.object({
  id: DocumentIdSchema.optional(),
  transactionId: z.string().optional(),
  productId: DocumentIdSchema.optional(),
  productName: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  locationId: z.string().optional(),
  type: z.enum(['Sale', 'Purchase']),
  quantity: z.number().positive({ message: "Quantity must be positive." }),
  price: z.number().min(0).optional(),
  totalRevenue: z.number().optional(),
  costPerUnit: z.number().optional(),
  totalCost: z.number().optional(),
  supplier: z.string().optional(),
  customerName: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  transactionDate: z.string().datetime({ message: "Invalid date format." }),
  userId: z.string().optional(),
});

// Zod schema for Supplier
export const SupplierSchema = z.object({
  id: DocumentIdSchema,
  name: z.string().min(1, { message: "Supplier name is required." }),
  contactName: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(),
  address: z.string().optional(),
  userId: z.string().optional(),
});

// Zod schema for PurchaseOrder
export const PurchaseOrderSchema = z.object({
  id: DocumentIdSchema,
  supplierId: DocumentIdSchema,
  orderDate: z.string().datetime({ message: "Invalid date format." }),
  expectedDeliveryDate: z.string().datetime({ message: "Invalid date format." }).optional(),
  status: z.enum(['Pending', 'Fulfilled', 'Cancelled']),
  productId: DocumentIdSchema,
  quantity: z.number().positive({ message: "Quantity must be positive." }),
  userId: z.string().optional(),
});


// AI Related Schemas

const SalesDataSchema = z.array(TransactionSchema.pick({ productId: true, quantity: true, transactionDate: true }));
const ProductDataSchema = z.array(ProductSchema.pick({ id: true, name: true, stock: true, price: true }));

export const BusinessStrategyInputSchema = z.object({
  sales: SalesDataSchema,
  products: ProductDataSchema,
});

export const BusinessStrategySchema = z.object({
  title: z.string().describe('A catchy title for the business strategy.'),
  keyRecommendations: z.array(z.string()).describe('A list of 3-5 actionable key recommendations for business growth.'),
  riskFactors: z.array(z.string()).describe('A list of potential risks or challenges associated with the strategy.'),
  expectedOutcomes: z.array(z.string()).describe('A list of expected positive outcomes if the strategy is implemented successfully.'),
});


const ProductInfoSchema = z.object({
  name: z.string(),
  stock: z.number(),
  averageDailySales: z.number(),
  leadTimeDays: z.number(),
});

export const LowStockInputSchema = z.object({
  products: z.array(ProductInfoSchema),
});

export const LowStockProductSchema = z.object({
    productName: z.string(),
    currentStock: z.number(),
    predictedDemand: z.string().describe("Predicted weekly demand for the product."),
    reorderSuggestion: z.number().describe("The suggested quantity to reorder."),
});

export const LowStockOutputSchema = z.object({
    lowStockProducts: z.array(LowStockProductSchema),
});
