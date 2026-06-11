
import { FieldValue } from "firebase/firestore";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  categoryId: string;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  stock: number;
  price: number;
  costPrice: number;
  imageUrl: string;
  supplierId: string;
  averageDailySales: number;
  leadTimeDays: number;
  userId?: string;
  tenantId?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  userId?: string;
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  transactionId?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  category?: string;
  locationId?: string;
  type: 'Sale' | 'Purchase';
  quantity: number;
  price: number; // Historical price at time of transaction
  totalRevenue?: number;
  costPerUnit?: number;
  totalCost?: number;
  supplier?: string;
  customerName?: string;
  paymentMethod?: string;
  status?: string;
  transactionDate: string | FieldValue;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  userId?: string;
  tenantId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  userId?: string;
  tenantId?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'Pending' | 'Fulfilled' | 'Cancelled';
  productId: string;
  quantity: number;
  createdAt: string | FieldValue;
  updatedAt: string | FieldValue;
  userId?: string;
  tenantId?: string;
}
