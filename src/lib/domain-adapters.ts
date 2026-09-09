/**
 * Domain Adapters (Hexagonal Architecture Translation Layer)
 * 
 * Insulates the business calculation engines (command-center-engine, copilot-engine,
 * forecasting-engine, supplier-intelligence-engine, etc.) from raw Firestore / database persistence shapes.
 */

export interface DomainProduct {
  id: string;
  name: string;
  productName: string;
  category: string;
  price: number;
  costPrice: number;
  compareAtPrice?: number;
  discountPercent?: number;
  liquidationStatus?: string;
  stock: number;
  minStock: number;
  maxStock: number;
  sku: string;
  supplier: string;
  supplierId: string;
  leadTimeDays: number;
  salesVelocity: number;
  averageDailySales: number;
  reorderPoint: number;
  reorderQuantity: number;
  profitMarginPercent: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  status: string;
  unit: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DomainTransaction {
  id: string;
  type: 'Sale' | 'Purchase';
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  totalRevenue: number;
  costPerUnit: number;
  totalCost: number;
  customerName: string;
  supplier: string;
  transactionDate: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface DomainSupplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  rating: number;
  performanceScore: number;
  onTimeDeliveryRate: number;
  pricingCompetitiveness: number;
  riskStatus: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical';
  priceVariancePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface DomainPurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Fulfilled';
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  totalAmount: number;
  notes?: string;
  userId?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DomainProductReturn {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  returnReason: string;
  returnDate: string;
  refundAmount: number;
  refundStatus: 'Pending' | 'Approved' | 'Rejected' | 'Refunded';
  condition: 'Damaged' | 'Defective' | 'Unopened' | 'Opened';
  disposition: 'Restock' | 'Scrap' | 'Return to Supplier';
  createdAt: string;
}

export interface DomainBusinessProfile {
  businessName: string;
  businessType: string;
  industry: string;
  businessSize: string;
  currency: string;
  timezone: string;
  country: string;
}

/* ------------------- ADAPTER FUNCTIONS ------------------- */

function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString();
  if (typeof raw === 'string') return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object' && typeof raw.toDate === 'function') {
    return raw.toDate().toISOString();
  }
  return new Date().toISOString();
}

function normalizeNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

export function toDomainProduct(p: any): DomainProduct {
  const price = normalizeNumber(p.price, 0);
  const costPrice = normalizeNumber(p.costPrice, Math.round(price * 0.6));
  const stock = normalizeNumber(p.stock, 0);
  const minStock = normalizeNumber(p.minStock, 5);
  const maxStock = normalizeNumber(p.maxStock, Math.max(100, stock * 2));
  const averageDailySales = normalizeNumber(p.averageDailySales, 0.5);
  const leadTimeDays = normalizeNumber(p.leadTimeDays, 7);
  const name = p.name || p.productName || p.title || 'Unnamed Product';

  const profitMarginPercent = price > 0 ? Math.round(((price - costPrice) / price) * 100) : 0;
  let riskLevel: DomainProduct['riskLevel'] = 'Low';
  if (stock === 0) riskLevel = 'High';
  else if (stock <= minStock) riskLevel = 'Medium';

  return {
    id: p.id || '',
    name,
    productName: name,
    category: p.category || 'General',
    price,
    costPrice,
    stock,
    minStock,
    maxStock,
    sku: (p.sku || '').toUpperCase(),
    supplier: p.supplier || p.supplierName || '',
    supplierId: p.supplierId || '',
    leadTimeDays,
    salesVelocity: normalizeNumber(p.salesVelocity, averageDailySales),
    averageDailySales,
    reorderPoint: normalizeNumber(p.reorderPoint, minStock),
    reorderQuantity: normalizeNumber(p.reorderQuantity, Math.max(10, Math.ceil(averageDailySales * (leadTimeDays + 14) - stock))),
    profitMarginPercent,
    riskLevel,
    compareAtPrice: p.compareAtPrice !== undefined ? normalizeNumber(p.compareAtPrice) : undefined,
    discountPercent: p.discountPercent !== undefined ? normalizeNumber(p.discountPercent) : undefined,
    liquidationStatus: p.liquidationStatus,
    status: p.status || 'Active',
    unit: p.unit || 'Piece',
    description: p.description || '',
    createdAt: normalizeDate(p.createdAt),
    updatedAt: normalizeDate(p.updatedAt),
  };
}

export function toDomainProducts(products: any[] = []): DomainProduct[] {
  return (products || []).map(toDomainProduct);
}

export function toDomainTransaction(t: any): DomainTransaction {
  const quantity = normalizeNumber(t.quantity ?? t.units_sold ?? t.qty ?? t.unitsSold ?? t.quantitySold, 1);
  const price = normalizeNumber(t.price ?? t.selling_price ?? t.sellingPrice ?? t.unitPrice ?? t.rate, 0);
  const costPerUnit = normalizeNumber(t.costPerUnit ?? t.costPrice ?? t.cost_per_unit ?? t.cost_price ?? t.cost ?? t.unitCost, Math.round(price * 0.6));
  const totalRevenue = normalizeNumber(t.totalRevenue ?? t.revenue ?? t.amount ?? t.total_revenue, price * quantity);
  const totalCost = normalizeNumber(t.totalCost ?? t.total_cost, costPerUnit * quantity);

  return {
    id: t.id || t.transactionId || t.sale_id || '',
    type: (t.type === 'Purchase' || t.type === 'purchase') ? 'Purchase' : 'Sale',
    productId: t.productId || t.product_id || '',
    productName: t.productName || t.product_name || t.name || 'Unnamed Item',
    sku: (t.sku || '').toUpperCase(),
    category: t.category || 'General',
    quantity,
    price,
    totalRevenue,
    costPerUnit,
    totalCost,
    customerName: t.customerName || t.customer_name || t.customer || 'Retail Customer',
    supplier: t.supplier || t.supplierName || t.supplier_name || '',
    transactionDate: normalizeDate(t.transactionDate || t.sale_date || t.orderDate || t.date || t.created_at),
    paymentMethod: t.paymentMethod || t.payment_method || t.paymentMode || 'UPI',
    status: t.status || 'Completed',
    createdAt: normalizeDate(t.createdAt || t.created_at),
  };
}

export function toDomainTransactions(transactions: any[] = []): DomainTransaction[] {
  return (transactions || []).map(toDomainTransaction);
}

export function toDomainSupplier(s: any): DomainSupplier {
  return {
    id: s.id || '',
    name: s.name || s.supplierName || 'Unknown Supplier',
    contactName: s.contactName || '',
    email: s.email || '',
    phone: s.phone || '',
    address: s.address || '',
    leadTimeDays: normalizeNumber(s.leadTimeDays, 7),
    rating: normalizeNumber(s.rating, 4.5),
    performanceScore: normalizeNumber(s.performanceScore, 85),
    onTimeDeliveryRate: normalizeNumber(s.onTimeDeliveryRate, 90),
    pricingCompetitiveness: normalizeNumber(s.pricingCompetitiveness, 85),
    riskStatus: s.riskStatus || 'Low Risk',
    priceVariancePercent: normalizeNumber(s.priceVariancePercent, 0),
    createdAt: normalizeDate(s.createdAt),
    updatedAt: normalizeDate(s.updatedAt),
  };
}

export function toDomainSuppliers(suppliers: any[] = []): DomainSupplier[] {
  return (suppliers || []).map(toDomainSupplier);
}

export function toDomainPurchaseOrder(o: any): DomainPurchaseOrder {
  const quantity = normalizeNumber(o.quantity, 1);
  const unitCost = normalizeNumber(o.unitCost, 0);
  const totalAmount = normalizeNumber(o.totalAmount || o.totalCost, quantity * unitCost);
  const validStatus = ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Fulfilled'];
  const status = validStatus.includes(o.status) ? o.status : 'Pending';

  return {
    id: o.id || '',
    supplierId: o.supplierId || '',
    supplierName: o.supplierName || o.supplier || '',
    orderDate: normalizeDate(o.orderDate),
    expectedDeliveryDate: normalizeDate(o.expectedDeliveryDate),
    status,
    productId: o.productId || '',
    productName: o.productName || '',
    quantity,
    unitCost,
    totalCost: totalAmount,
    totalAmount,
    createdAt: normalizeDate(o.createdAt),
    updatedAt: normalizeDate(o.updatedAt),
  };
}

export function toDomainPurchaseOrders(orders: any[] = []): DomainPurchaseOrder[] {
  return (orders || []).map(toDomainPurchaseOrder);
}

export function toDomainProductReturn(r: any): DomainProductReturn {
  return {
    id: r.id || '',
    productId: r.productId || '',
    productName: r.productName || '',
    sku: (r.sku || '').toUpperCase(),
    category: r.category || 'General',
    quantity: normalizeNumber(r.quantity, 1),
    returnReason: r.returnReason || 'Defective',
    returnDate: normalizeDate(r.returnDate || r.date),
    refundAmount: normalizeNumber(r.refundAmount, 0),
    refundStatus: r.refundStatus || 'Approved',
    condition: r.condition || 'Opened',
    disposition: r.disposition || 'Restock',
    createdAt: normalizeDate(r.createdAt),
  };
}

export function toDomainProductReturns(returns: any[] = []): DomainProductReturn[] {
  return (returns || []).map(toDomainProductReturn);
}

export function toDomainBusinessProfile(bp: any): DomainBusinessProfile {
  return {
    businessName: bp?.businessName || 'My Business',
    businessType: bp?.businessType || 'Retail',
    industry: bp?.industry || 'General Retail Store',
    businessSize: bp?.businessSize || '2-10 Employees',
    currency: bp?.currency || 'INR (₹)',
    timezone: bp?.timezone || 'Asia/Kolkata (GMT+5:30)',
    country: bp?.country || 'India',
  };
}
