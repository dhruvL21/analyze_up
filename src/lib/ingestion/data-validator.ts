/**
 * Ingestion: Deterministic Data Validator & Normalizer
 * Pure code for type conversion, missing value handling, duplicate detection, and schema validation.
 */
import {
  CanonicalProduct,
  CanonicalProductSchema,
  CanonicalSale,
  CanonicalSaleSchema,
} from '@/schemas/canonical';
import { NormalizationOutput } from '@/schemas/mapping-contract';

/* ----------------- NUMERIC & DATE CLEANERS ----------------- */

export function cleanNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim().replace(/,/g, '').replace(/[₹$€£%]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? fallback : parsed;
}

export function cleanInteger(val: any, fallback = 0): number {
  const num = cleanNumber(val, fallback);
  return Math.round(num);
}

export function cleanDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];

  const str = String(val).trim();
  // Check ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Check MM/DD/YYYY
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/* ----------------- DATASET NORMALIZERS ----------------- */

export function isNumericString(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().replace(/,/g, '').replace(/[₹$€£%]/g, '');
  return s.length > 0 && !isNaN(Number(s));
}

export function findFallbackProductName(row: Record<string, any>): string {
  for (const [key, val] of Object.entries(row)) {
    if (!val) continue;
    const str = String(val).trim();
    if (!str || str === '0.00' || str === '0' || isNumericString(str)) continue;

    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('discount') ||
      lowerKey.includes('tax') ||
      lowerKey.includes('price') ||
      lowerKey.includes('cost') ||
      lowerKey.includes('qty') ||
      lowerKey.includes('sku') ||
      lowerKey.includes('order') ||
      lowerKey.includes('invoice') ||
      lowerKey.includes('date')
    ) {
      continue;
    }

    if (
      lowerKey.includes('name') ||
      lowerKey.includes('title') ||
      lowerKey.includes('item') ||
      lowerKey.includes('product') ||
      lowerKey.includes('desc')
    ) {
      return str;
    }
  }
  return '';
}

export function findFallbackPrice(row: Record<string, any>, defaultVal = 0): number {
  for (const [key, val] of Object.entries(row)) {
    if (!val) continue;
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('discount') ||
      lowerKey.includes('tax') ||
      lowerKey.includes('cost') ||
      lowerKey.includes('purchase')
    ) {
      continue;
    }

    if (
      lowerKey.includes('price') ||
      lowerKey.includes('rate') ||
      lowerKey.includes('mrp') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('selling')
    ) {
      const num = cleanNumber(val, 0);
      if (num > 0) return num;
    }
  }
  return defaultVal;
}

export function normalizeToProducts(
  rawRows: Record<string, any>[],
  fieldMapping: Record<string, string>
): NormalizationOutput<CanonicalProduct> {
  const validRecords: CanonicalProduct[] = [];
  const errorRecords: NormalizationOutput['errorRecords'] = [];
  const warnings: string[] = [];
  const seenSkus = new Set<string>();
  let skippedDuplicates = 0;

  rawRows.forEach((row, idx) => {
    const mapped: Record<string, any> = {};
    const rowNum = idx + 1;

    Object.entries(fieldMapping).forEach(([sourceCol, targetKey]) => {
      if (targetKey && targetKey !== 'skip' && targetKey !== 'customAttribute') {
        mapped[targetKey] = row[sourceCol];
      }
    });

    let name = String(mapped.name || mapped.productName || mapped.product_name || mapped.title || mapped.itemName || mapped.item_name || '').trim();
    // Resilient fallback if name was overwritten with numeric values like 0.00
    if (!name || name === '0.00' || name === '0' || isNumericString(name)) {
      const fallback = findFallbackProductName(row);
      if (fallback) name = fallback;
    }

    if (!name || name === '0.00') {
      errorRecords.push({
        rowNumber: rowNum,
        rawRow: row,
        errors: ['Missing required product name/title.'],
      });
      return;
    }

    const rawSku = String(mapped.sku || mapped.item_code || mapped.itemCode || mapped.barcode || `SKU-${idx + 1}`).trim().toUpperCase();
    const sku = rawSku.length > 0 ? rawSku : `SKU-${idx + 1}`;

    if (seenSkus.has(sku)) {
      skippedDuplicates++;
      warnings.push(`Duplicate SKU "${sku}" found at row ${rowNum} — updated with latest record.`);
    } else {
      seenSkus.add(sku);
    }

    let price = cleanNumber(mapped.price || mapped.sellingPrice || mapped.selling_price || mapped.salePrice || mapped.retailPrice, 0);
    if (price <= 0) {
      price = findFallbackPrice(row, 0);
    }

    const costPrice = cleanNumber(mapped.costPrice || mapped.cost_price || mapped.cost || mapped.unitCost || mapped.purchasePrice, Math.round(price * 0.6));
    const stock = cleanInteger(mapped.stock || mapped.inventory_quantity || mapped.inventoryQuantity || mapped.quantity || mapped.qty || mapped.currentStock, 0);
    const minStock = cleanInteger(mapped.minStock || mapped.min_stock || mapped.safetyStock || mapped.safety_stock, 5);
    const maxStock = cleanInteger(mapped.maxStock || mapped.max_stock, Math.max(100, stock * 2));
    const leadTime = cleanInteger(mapped.leadTimeDays || mapped.lead_time_days || mapped.leadTime, 7);

    const productCandidate: CanonicalProduct = {
      product_id: mapped.product_id || mapped.productId ? String(mapped.product_id || mapped.productId) : `prod-${sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      product_name: name,
      sku,
      category: String(mapped.category || mapped.department || 'General').trim() || 'General',
      inventory_quantity: stock,
      min_stock: minStock,
      max_stock: maxStock,
      price,
      cost_price: costPrice,
      supplier_name: String(mapped.supplier || mapped.supplierName || mapped.supplier_name || mapped.vendor || '').trim(),
      supplier_id: String(mapped.supplierId || mapped.supplier_id || '').trim(),
      lead_time_days: leadTime > 0 ? leadTime : 7,
      unit: String(mapped.unit || 'Piece').trim() || 'Piece',
      brand: String(mapped.brand || '').trim(),
      barcode: String(mapped.barcode || '').trim(),
      description: String(mapped.description || mapped.remarks || '').trim(),
      custom_attributes: { ...row },
      raw_attributes: { ...row },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parseResult = CanonicalProductSchema.safeParse(productCandidate);
    if (parseResult.success) {
      validRecords.push(parseResult.data);
    } else {
      errorRecords.push({
        rowNumber: rowNum,
        rawRow: row,
        errors: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      });
    }
  });

  return {
    success: validRecords.length > 0,
    validRecords,
    errorRecords,
    skippedDuplicates,
    warnings,
    normalizedSchema: 'analyzeup_v1',
  };
}

export function normalizeToSales(
  rawRows: Record<string, any>[],
  fieldMapping: Record<string, string>
): NormalizationOutput<CanonicalSale> {
  const validRecords: CanonicalSale[] = [];
  const errorRecords: NormalizationOutput['errorRecords'] = [];
  const warnings: string[] = [];

  rawRows.forEach((row, idx) => {
    const mapped: Record<string, any> = {};
    const rowNum = idx + 1;

    Object.entries(fieldMapping).forEach(([sourceCol, targetKey]) => {
      if (targetKey && targetKey !== 'skip' && targetKey !== 'customAttribute') {
        mapped[targetKey] = row[sourceCol];
      }
    });

    let productName = String(mapped.productName || mapped.product_name || mapped.name || mapped.itemName || mapped.item_name || '').trim();
    // Resilient fallback if productName was overwritten with numeric values like 0.00
    if (!productName || productName === '0.00' || productName === '0' || isNumericString(productName)) {
      const fallback = findFallbackProductName(row);
      if (fallback) productName = fallback;
    }

    if (!productName || productName === '0.00') {
      errorRecords.push({
        rowNumber: rowNum,
        rawRow: row,
        errors: ['Missing product name for sales record.'],
      });
      return;
    }

    const unitsSold = cleanInteger(mapped.quantity || mapped.units_sold || mapped.unitsSold || mapped.qty, 1);
    let sellingPrice = cleanNumber(mapped.sellingPrice || mapped.selling_price || mapped.price || mapped.unitPrice || mapped.unit_price, 0);
    if (sellingPrice <= 0) {
      sellingPrice = findFallbackPrice(row, 0);
    }

    const costPerUnit = cleanNumber(mapped.costPrice || mapped.cost_per_unit || mapped.costPerUnit || mapped.cost_price || mapped.cost, Math.round(sellingPrice * 0.6));
    const revenue = cleanNumber(mapped.revenue || mapped.total_revenue || mapped.totalRevenue || mapped.amount, sellingPrice * unitsSold);
    const totalCost = cleanNumber(mapped.totalCost || mapped.total_cost, costPerUnit * unitsSold);
    const discount = cleanNumber(mapped.discount || row['Discount'] || row['Item Discount'] || 0);
    const tax = cleanNumber(mapped.tax || row['Tax'] || row['Item Tax'] || 0);

    const saleCandidate: CanonicalSale = {
      sale_id: mapped.saleId || mapped.sale_id ? String(mapped.saleId || mapped.sale_id) : `sale-${Date.now()}-${idx}`,
      order_number: String(mapped.orderNumber || mapped.order_number || mapped.orderId || mapped.order_id || mapped.invoiceNumber || mapped.invoice_number || `INV-${1000 + idx}`).trim(),
      product_id: mapped.productId || mapped.product_id ? String(mapped.productId || mapped.product_id) : `prod-${productName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      product_name: productName,
      sku: String(mapped.sku || `SKU-${idx + 1}`).trim().toUpperCase(),
      category: String(mapped.category || 'General').trim() || 'General',
      units_sold: unitsSold > 0 ? unitsSold : 1,
      selling_price: sellingPrice,
      cost_per_unit: costPerUnit,
      revenue,
      total_cost: totalCost,
      discount,
      tax,
      customer_name: String(mapped.customerName || mapped.customer_name || mapped.customer || 'Retail Customer').trim(),
      supplier_name: String(mapped.supplierName || mapped.supplier_name || mapped.supplier || '').trim(),
      sale_date: cleanDate(mapped.orderDate || mapped.saleDate || mapped.sale_date || mapped.date || mapped.order_date),
      payment_method: String(mapped.paymentMode || mapped.payment_method || mapped.paymentMethod || mapped.payment || 'UPI').trim(),
      status: 'Completed',
      custom_attributes: { ...row },
      raw_attributes: { ...row },
      created_at: new Date().toISOString(),
    };

    const parseResult = CanonicalSaleSchema.safeParse(saleCandidate);
    if (parseResult.success) {
      validRecords.push(parseResult.data);
    } else {
      errorRecords.push({
        rowNumber: rowNum,
        rawRow: row,
        errors: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      });
    }
  });

  return {
    success: validRecords.length > 0,
    validRecords,
    errorRecords,
    skippedDuplicates: 0,
    warnings,
    normalizedSchema: 'analyzeup_v1',
  };
}
