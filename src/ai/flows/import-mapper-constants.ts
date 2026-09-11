export type BusinessFileType =
  | 'INVENTORY_MASTER'
  | 'SALES_REPORT'
  | 'PURCHASE_ORDERS'
  | 'SUPPLIER_LIST'
  | 'CUSTOMER_LIST'
  | 'RETURNS_REPORT'
  | 'WAREHOUSE_STOCK'
  | 'UNKNOWN';

export interface FileTypeDefinition {
  type: BusinessFileType;
  name: string;
  description: string;
  badgeColor: string;
  iconName: string;
  fields: TargetFieldDef[];
}

export interface TargetFieldDef {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

// 1. Inventory Master Target Fields
export const INVENTORY_FIELDS: TargetFieldDef[] = [
  { key: 'name', label: 'Product Name / Item Name', required: true, description: 'Title or name of the product' },
  { key: 'sku', label: 'SKU / Product Code', required: false, description: 'Stock keeping unit identifier' },
  { key: 'category', label: 'Category', required: false, description: 'Product category or group' },
  { key: 'price', label: 'Retail Price / Selling Price', required: true, description: 'Price sold to customers' },
  { key: 'costPrice', label: 'Purchase Price / Cost Price', required: false, description: 'Cost price from supplier' },
  { key: 'stock', label: 'Current Stock / Quantity', required: false, description: 'Available inventory units' },
  { key: 'minStock', label: 'Reorder Level / Minimum Stock', required: false, description: 'Low stock reorder threshold' },
  { key: 'safetyStock', label: 'Safety Stock', required: false, description: 'Buffer stock for supply volatility' },
  { key: 'leadTimeDays', label: 'Lead Time Days', required: false, description: 'Supplier fulfillment lead time in days' },
  { key: 'supplier', label: 'Supplier Name / Vendor', required: false, description: 'Supplier company name' },
  { key: 'supplierId', label: 'Supplier ID', required: false, description: 'Supplier unique code / identifier' },
  { key: 'brand', label: 'Brand', required: false, description: 'Brand or manufacturer' },
  { key: 'unit', label: 'Unit of Measure', required: false, description: 'Piece, Kg, Box, Pack, etc.' },
  { key: 'city', label: 'Warehouse / Branch Location', required: false, description: 'Warehouse, branch, or fulfillment center' },
  { key: 'status', label: 'Item Status / Order Status', required: false, description: 'Active, Inactive, Discontinued' },
  { key: 'remarks', label: 'Remarks / Notes', required: false, description: 'Product notes or remarks' },
  { key: 'description', label: 'Description', required: false, description: 'Product specifications or details' },
  { key: 'customAttribute', label: 'Custom Attribute / Store in Database', required: false, description: 'Store column directly in database as custom field' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

// 2. Sales Report Target Fields
export const SALES_FIELDS: TargetFieldDef[] = [
  { key: 'orderNumber', label: 'Invoice No / Order Number', required: true, description: 'Unique order or bill identifier' },
  { key: 'orderId', label: 'Order ID', required: false, description: 'Order reference / identification number' },
  { key: 'orderDate', label: 'Order Date', required: false, description: 'Date transaction took place' },
  { key: 'customerName', label: 'Customer Name', required: false, description: 'Name of the buyer' },
  { key: 'customerId', label: 'Customer ID', required: false, description: 'Unique customer identifier' },
  { key: 'sku', label: 'SKU / Product Code', required: false, description: 'Product SKU' },
  { key: 'productName', label: 'Item Name / Product Name', required: true, description: 'Item or product name sold' },
  { key: 'category', label: 'Category', required: false, description: 'Product category' },
  { key: 'quantity', label: 'Qty Sold / Quantity', required: true, description: 'Number of units sold' },
  { key: 'costPrice', label: 'Purchase Price / Cost Price', required: false, description: 'Historical purchase cost per unit' },
  { key: 'sellingPrice', label: 'Retail Price / Selling Price', required: true, description: 'Price per item at sale' },
  { key: 'discount', label: 'Discount Amount / %', required: false, description: 'Discount applied on sale' },
  { key: 'tax', label: 'Tax Amount (GST/VAT)', required: false, description: 'Tax collected' },
  { key: 'stock', label: 'Current Stock / Quantity', required: false, description: 'Available inventory units' },
  { key: 'minStock', label: 'Reorder Level / Minimum Stock', required: false, description: 'Reorder threshold' },
  { key: 'safetyStock', label: 'Safety Stock', required: false, description: 'Buffer safety stock level' },
  { key: 'leadTimeDays', label: 'Lead Time Days', required: false, description: 'Supplier delivery lead time in days' },
  { key: 'paymentMode', label: 'Payment Mode / Method', required: false, description: 'Cash, Card, UPI, Net Banking' },
  { key: 'status', label: 'Order Status', required: false, description: 'Delivered, Completed, Pending, Shipped, Cancelled' },
  { key: 'supplier', label: 'Supplier Name / Vendor', required: false, description: 'Supplier or fulfillment vendor' },
  { key: 'supplierId', label: 'Supplier ID', required: false, description: 'Supplier unique code' },
  { key: 'city', label: 'Warehouse / Region / Location', required: false, description: 'Warehouse or delivery destination' },
  { key: 'remarks', label: 'Remarks / Notes', required: false, description: 'Order remarks or delivery notes' },
  { key: 'customAttribute', label: 'Custom Attribute / Store in Database', required: false, description: 'Store column directly in database as custom field' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

// 3. Purchase Orders Target Fields
export const PURCHASE_ORDER_FIELDS: TargetFieldDef[] = [
  { key: 'poNumber', label: 'PO Number', required: true, description: 'Purchase order reference' },
  { key: 'orderDate', label: 'Order Date', required: false, description: 'Date order was issued' },
  { key: 'expectedDate', label: 'Expected Delivery Date', required: false, description: 'Expected arrival date' },
  { key: 'supplierName', label: 'Supplier / Vendor Name', required: true, description: 'Supplier fulfilling the PO' },
  { key: 'productName', label: 'Product Name', required: true, description: 'Item being reordered' },
  { key: 'quantity', label: 'Quantity Ordered', required: true, description: 'Number of units ordered' },
  { key: 'unitCost', label: 'Unit Cost Price', required: false, description: 'Agreed purchase price per unit' },
  { key: 'status', label: 'PO Status', required: false, description: 'Pending, Fulfilled, Cancelled' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

// 4. Supplier List Target Fields
export const SUPPLIER_FIELDS: TargetFieldDef[] = [
  { key: 'supplierName', label: 'Supplier / Vendor Name', required: true, description: 'Company or supplier name' },
  { key: 'contactName', label: 'Contact Person', required: false, description: 'Primary contact representative' },
  { key: 'email', label: 'Email Address', required: false, description: 'Supplier contact email' },
  { key: 'phone', label: 'Phone Number', required: false, description: 'Supplier contact phone' },
  { key: 'address', label: 'Address / Location', required: false, description: 'Office or warehouse address' },
  { key: 'leadTimeDays', label: 'Lead Time (Days)', required: false, description: 'Average fulfillment lead time in days' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

// 5. Customer List Target Fields
export const CUSTOMER_FIELDS: TargetFieldDef[] = [
  { key: 'customerName', label: 'Customer Name', required: true, description: 'Full name or business name' },
  { key: 'email', label: 'Email Address', required: false, description: 'Customer email' },
  { key: 'phone', label: 'Phone Number', required: false, description: 'Customer phone number' },
  { key: 'city', label: 'City / Region', required: false, description: 'City or state' },
  { key: 'address', label: 'Address', required: false, description: 'Delivery or billing address' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

// 6. Returns Report Target Fields
export const RETURNS_FIELDS: TargetFieldDef[] = [
  { key: 'returnId', label: 'Return Reference / ID', required: false, description: 'Return ticket number' },
  { key: 'orderNumber', label: 'Original Invoice / Order No', required: false, description: 'Associated sales order' },
  { key: 'customerName', label: 'Customer Name', required: false, description: 'Customer returning item' },
  { key: 'productName', label: 'Product Name', required: true, description: 'Returned product name' },
  { key: 'quantity', label: 'Returned Quantity', required: true, description: 'Number of units returned' },
  { key: 'reason', label: 'Return Reason', required: false, description: 'Defective, Damaged, Wrong Item, Buyer Remorse' },
  { key: 'actionTaken', label: 'Action Taken', required: false, description: 'Restocked, Disposed / Written Off' },
  { key: 'refundAmount', label: 'Refund Amount', required: false, description: 'Amount refunded to customer' },
  { key: 'skip', label: '— Skip / Ignore Column —', required: false, description: 'Do not import this column' },
];

export const FILE_TYPE_DEFINITIONS: Record<BusinessFileType, FileTypeDefinition> = {
  INVENTORY_MASTER: {
    type: 'INVENTORY_MASTER',
    name: 'Inventory Master Catalog',
    description: 'Product master list with stock counts, cost prices, selling prices, and supplier details',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    iconName: 'Package',
    fields: INVENTORY_FIELDS,
  },
  SALES_REPORT: {
    type: 'SALES_REPORT',
    name: 'Sales & Revenue Report',
    description: 'Completed customer invoices, daily transaction orders, quantity sold, and revenue',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    iconName: 'TrendingUp',
    fields: SALES_FIELDS,
  },
  PURCHASE_ORDERS: {
    type: 'PURCHASE_ORDERS',
    name: 'Purchase Orders (Reorders)',
    description: 'Supplier reorders, expected arrival dates, quantities ordered, and fulfillment status',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    iconName: 'ShoppingBag',
    fields: PURCHASE_ORDER_FIELDS,
  },
  SUPPLIER_LIST: {
    type: 'SUPPLIER_LIST',
    name: 'Supplier & Vendor Directory',
    description: 'List of vendor contacts, email addresses, lead times, and fulfillment details',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    iconName: 'Truck',
    fields: SUPPLIER_FIELDS,
  },
  CUSTOMER_LIST: {
    type: 'CUSTOMER_LIST',
    name: 'Customer Directory',
    description: 'Customer contact details, locations, and buying history',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    iconName: 'Users',
    fields: CUSTOMER_FIELDS,
  },
  RETURNS_REPORT: {
    type: 'RETURNS_REPORT',
    name: 'Product Returns & Claims',
    description: 'Customer product returns, return reasons, disposal actions, and refund amounts',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    iconName: 'RotateCcw',
    fields: RETURNS_FIELDS,
  },
  WAREHOUSE_STOCK: {
    type: 'WAREHOUSE_STOCK',
    name: 'Warehouse Stock Audit',
    description: 'Physical inventory count, bin locations, and warehouse stock levels',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    iconName: 'Warehouse',
    fields: INVENTORY_FIELDS,
  },
  UNKNOWN: {
    type: 'UNKNOWN',
    name: 'General Business File',
    description: 'Unclassified dataset',
    badgeColor: 'bg-secondary text-muted-foreground',
    iconName: 'FileText',
    fields: INVENTORY_FIELDS,
  },
};

export type FieldMapping = Record<string, string>;
