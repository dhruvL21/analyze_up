'use server';

import { openai, AI_MODELS } from '@/ai/openai';
import { scrubPII } from '@/ai/privacy/privacy-gateway';
import { INVENTORY_FIELDS, FieldMapping, TargetFieldDef } from './import-mapper-constants';

export async function getSmartMapping(
  externalHeaders: string[],
  sampleRows: Record<string, any>[] = []
): Promise<{ mapping: FieldMapping; confidence: Record<string, number>; isAiPowered: boolean }> {
  const mapping: FieldMapping = {};
  const confidence: Record<string, number> = {};
  const targetFieldKeys = INVENTORY_FIELDS.map((f: TargetFieldDef) => f.key);

  const sampleSnippet = sampleRows.slice(0, 3).map(row => {
    const cleaned: Record<string, any> = {};
    externalHeaders.forEach(h => {
      const val = row[h];
      cleaned[h] = typeof val === 'string' ? scrubPII(val) : val;
    });
    return cleaned;
  });

  const prompt = `
You are an expert AI Data Engineering Assistant for AnalyzeUp AI inventory software.
Map the external CSV columns to the target internal product schema fields.

TARGET INTERNAL SCHEMA FIELDS:
- "name": Product Name, Item Name, Title (REQUIRED)
- "price": Selling Price, Retail Price, MRP, Sale Price (REQUIRED)
- "costPrice": Purchase Price, Unit Cost, Buy Price
- "stock": Quantity, Qty Sold, Units in Stock, Available Stock
- "sku": SKU, Item Code, Product Code, Barcode
- "category": Product Category, Department
- "brand": Brand, Manufacturer
- "supplier": Supplier Name, Vendor Name, Supplier/Vendor
- "minStock": Minimum Stock Threshold, Reorder Level
- "unit": Measurement Unit (Piece, Kg, Box, etc.)
- "city": Warehouse / Branch City, Location
- "status": Item Status, Product Status
- "remarks": Product Remarks, Notes
- "description": Product Details, Description, Notes
- "skip": Columns that are irrelevant

EXTERNAL CSV HEADERS:
${externalHeaders.join(', ')}

SAMPLE DATA ROWS:
${JSON.stringify(sampleSnippet, null, 2)}

INSTRUCTIONS:
1. Return a JSON object where keys are EXACT external CSV headers, and values are target field keys listed above.
2. Provide a confidence score (0.0 to 1.0) for each mapping.

EXAMPLE RESPONSE FORMAT:
{
  "mappings": {
    "Item Name": "name",
    "Retail Price": "price",
    "Purchase Price (₹)": "costPrice",
    "Qty Sold": "stock",
    "Supplier / Vendor": "supplier",
    "Invoice No": "skip"
  },
  "confidence": {
    "Item Name": 0.98,
    "Retail Price": 0.95,
    "Purchase Price (₹)": 0.95,
    "Qty Sold": 0.92,
    "Supplier / Vendor": 0.95,
    "Invoice No": 0.99
  }
}

Respond ONLY with valid JSON.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODELS.FLAGSHIP,
      messages: [
        { role: 'system', content: 'You are an intelligent data mapping and normalization assistant.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const aiMap = parsed.mappings || {};
    const aiConf = parsed.confidence || {};

    externalHeaders.forEach(h => {
      const target = aiMap[h];
      if (target && targetFieldKeys.includes(target)) {
        mapping[h] = target;
        confidence[h] = Math.round((aiConf[h] || 0.9) * 100);
      } else {
        const fuzzy = getFuzzySemanticMatch(h);
        mapping[h] = fuzzy;
        confidence[h] = fuzzy !== 'skip' ? 85 : 50;
      }
    });

    return { mapping, confidence, isAiPowered: true };
  } catch (error) {
    console.warn('AI Mapping Fallback to Rule Engine:', error);

    externalHeaders.forEach(h => {
      const match = getFuzzySemanticMatch(h);
      mapping[h] = match;
      confidence[h] = match !== 'skip' ? 90 : 60;
    });

    return { mapping, confidence, isAiPowered: false };
  }
}

/**
 * Intelligent semantic fuzzy matcher for fallback matching
 */
function getFuzzySemanticMatch(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

  // Product Name
  if (
    h.includes('item name') ||
    h.includes('product name') ||
    h.includes('item title') ||
    h.includes('product title') ||
    h === 'title' ||
    h === 'item' ||
    h === 'product' ||
    h.includes('product_name') ||
    h.includes('item_name')
  ) {
    return 'name';
  }

  // Selling Price
  if (
    h.includes('retail price') ||
    h.includes('selling price') ||
    h.includes('sale price') ||
    h.includes('mrp') ||
    h.includes('unit price') ||
    h === 'price' ||
    h.includes('retail') ||
    h.includes('selling_price')
  ) {
    return 'price';
  }

  // Cost Price
  if (
    h.includes('purchase price') ||
    h.includes('cost price') ||
    h.includes('buy price') ||
    h.includes('unit cost') ||
    h === 'cost' ||
    h.includes('cost_price') ||
    h.includes('purchase')
  ) {
    return 'costPrice';
  }

  // Stock / Quantity
  if (
    h.includes('qty sold') ||
    h.includes('qty') ||
    h.includes('quantity') ||
    h.includes('stock') ||
    h.includes('units') ||
    h.includes('current stock') ||
    h.includes('available') ||
    h.includes('in stock')
  ) {
    return 'stock';
  }

  // Supplier
  if (
    h.includes('supplier') ||
    h.includes('vendor') ||
    h.includes('distributor') ||
    h.includes('manufacturer')
  ) {
    return 'supplier';
  }

  // SKU / Code
  if (
    h.includes('sku') ||
    h.includes('item code') ||
    h.includes('product code') ||
    h.includes('barcode') ||
    h === 'code' ||
    h.includes('model no') ||
    h.includes('invoice no')
  ) {
    return 'sku';
  }

  // Category
  if (
    h.includes('category') ||
    h.includes('department') ||
    h.includes('group') ||
    h.includes('type')
  ) {
    return 'category';
  }

  // Brand
  if (h.includes('brand') || h.includes('make')) {
    return 'brand';
  }

  // Min Stock
  if (
    h.includes('min stock') ||
    h.includes('minimum stock') ||
    h.includes('reorder') ||
    h.includes('threshold')
  ) {
    return 'minStock';
  }

  // Unit
  if (h.includes('unit') || h.includes('uom') || h.includes('pack')) {
    return 'unit';
  }

  // City / Location
  if (h === 'city' || h.includes('city') || h.includes('location') || h.includes('region') || h.includes('destination') || h.includes('place')) {
    return 'city';
  }

  // Status
  if (h.includes('status') || h.includes('state') || h.includes('condition')) {
    return 'status';
  }

  // Remarks / Notes
  if (h.includes('remark') || h.includes('notes') || h.includes('comment') || h.includes('feedback')) {
    return 'remarks';
  }

  // Description
  if (
    h.includes('desc') ||
    h.includes('description') ||
    h.includes('details')
  ) {
    return 'description';
  }

  return 'skip';
}
