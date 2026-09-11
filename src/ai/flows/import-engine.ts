import { openai, isOpenAIConfigured } from '@/ai/openai';
import {
  BusinessFileType,
  FILE_TYPE_DEFINITIONS,
  FieldMapping,
  TargetFieldDef,
} from './import-mapper-constants';

export interface DetectionResult {
  fileType: BusinessFileType;
  fileTypeName: string;
  confidence: number; // 0 - 100
  reasoning: string;
  isAiPowered: boolean;
}

/**
 * Stage 1: AI File Type Detection
 */
export async function detectBusinessFileType(
  externalHeaders: string[],
  sampleRows: Record<string, any>[] = []
): Promise<DetectionResult> {
  if (!isOpenAIConfigured()) {
    return heuristicDetectFileType(externalHeaders);
  }
  const sampleSnippet = sampleRows.slice(0, 3).map(row => {
    const cleaned: Record<string, any> = {};
    externalHeaders.forEach(h => {
      cleaned[h] = row[h];
    });
    return cleaned;
  });

  const prompt = `
You are an expert AI Human Accountant & Chief Data Officer for AnalyzeUp business intelligence software.
Analyze the CSV headers and sample data rows to determine WHAT TYPE of business file this is.

POSSIBLE FILE TYPES:
1. "INVENTORY_MASTER": Product list, master catalog, stock levels, cost & selling prices, SKUs, suppliers.
2. "SALES_REPORT": Invoices, sales transactions, order numbers, customer names, quantity sold, sales revenue, payment methods.
3. "PURCHASE_ORDERS": Supplier purchase orders, expected delivery dates, quantities ordered, unit cost prices, PO status.
4. "SUPPLIER_LIST": Supplier directory, vendor names, contact persons, phone numbers, emails, lead times.
5. "CUSTOMER_LIST": Customer directory, names, emails, phone numbers, cities, loyalty points.
6. "RETURNS_REPORT": Product returns, return tickets, return reasons, disposal actions, refund amounts.
7. "WAREHOUSE_STOCK": Warehouse bin stock counts, physical inventory counts.
8. "UNKNOWN": Unrelated or general file.

CSV HEADERS:
${externalHeaders.join(', ')}

SAMPLE DATA ROWS:
${JSON.stringify(sampleSnippet, null, 2)}

INSTRUCTIONS:
1. Identify the MOST ACCURATE Business File Type.
2. Assign a confidence score from 50 to 99 (e.g. 98).
3. Provide a short 1-sentence reasoning in plain English for a business owner (e.g. "Contains Invoice Numbers, Customer Names, and Quantities Sold").

EXAMPLE RESPONSE FORMAT:
{
  "fileType": "SALES_REPORT",
  "confidence": 98,
  "reasoning": "Detected invoice numbers, customer names, quantity sold, and payment methods characteristic of a sales report."
}

Respond ONLY with valid JSON.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an intelligent business file classifier.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const rawType = (parsed.fileType || 'UNKNOWN').toUpperCase() as BusinessFileType;
    const fileType = FILE_TYPE_DEFINITIONS[rawType] ? rawType : 'INVENTORY_MASTER';
    const confidence = Math.min(99, Math.max(50, Number(parsed.confidence) || 90));
    const reasoning = parsed.reasoning || `Detected ${FILE_TYPE_DEFINITIONS[fileType].name} based on header patterns.`;

    return {
      fileType,
      fileTypeName: FILE_TYPE_DEFINITIONS[fileType].name,
      confidence,
      reasoning,
      isAiPowered: true,
    };
  } catch (error) {
    console.warn('AI File Type Detection Fallback to Heuristics:', error);
    // Rule Engine Fallback
    return heuristicDetectFileType(externalHeaders);
  }
}

function heuristicDetectFileType(headers: string[]): DetectionResult {
  const hCombined = headers.join(' ').toLowerCase();

  if (
    hCombined.includes('invoice') ||
    hCombined.includes('order no') ||
    hCombined.includes('qty sold') ||
    hCombined.includes('customer name') ||
    hCombined.includes('payment')
  ) {
    return {
      fileType: 'SALES_REPORT',
      fileTypeName: FILE_TYPE_DEFINITIONS.SALES_REPORT.name,
      confidence: 95,
      reasoning: 'Recognized invoice numbers, order dates, and quantity sold columns.',
      isAiPowered: false,
    };
  }

  if (
    hCombined.includes('po number') ||
    hCombined.includes('po no') ||
    hCombined.includes('expected date') ||
    hCombined.includes('quantity ordered')
  ) {
    return {
      fileType: 'PURCHASE_ORDERS',
      fileTypeName: FILE_TYPE_DEFINITIONS.PURCHASE_ORDERS.name,
      confidence: 94,
      reasoning: 'Recognized purchase order references and supplier fulfillment columns.',
      isAiPowered: false,
    };
  }

  if (
    hCombined.includes('return reason') ||
    hCombined.includes('refund') ||
    hCombined.includes('action taken') ||
    hCombined.includes('return id')
  ) {
    return {
      fileType: 'RETURNS_REPORT',
      fileTypeName: FILE_TYPE_DEFINITIONS.RETURNS_REPORT.name,
      confidence: 93,
      reasoning: 'Recognized return reasons, refund amounts, and restock actions.',
      isAiPowered: false,
    };
  }

  if (
    hCombined.includes('supplier name') &&
    (hCombined.includes('contact') || hCombined.includes('lead time')) &&
    !hCombined.includes('price')
  ) {
    return {
      fileType: 'SUPPLIER_LIST',
      fileTypeName: FILE_TYPE_DEFINITIONS.SUPPLIER_LIST.name,
      confidence: 92,
      reasoning: 'Recognized vendor contact directory and lead-time fields.',
      isAiPowered: false,
    };
  }

  return {
    fileType: 'INVENTORY_MASTER',
    fileTypeName: FILE_TYPE_DEFINITIONS.INVENTORY_MASTER.name,
    confidence: 88,
    reasoning: 'Recognized product catalog, stock levels, and price fields.',
    isAiPowered: false,
  };
}

/**
 * Stage 2 & 3: Smart Semantic Mapping tailored to Detected File Type
 */
/**
 * Stage 2 & 3: Smart Semantic Mapping tailored to Detected File Type
 */
export async function getSmartMappingForFileType(
  fileType: BusinessFileType,
  externalHeaders: string[],
  sampleRows: Record<string, any>[] = []
): Promise<{ mapping: FieldMapping; confidence: Record<string, number>; isAiPowered: boolean }> {
  const targetFields = FILE_TYPE_DEFINITIONS[fileType]?.fields || FILE_TYPE_DEFINITIONS.INVENTORY_MASTER.fields;
  const targetFieldKeys = targetFields.map(f => f.key);

  if (!isOpenAIConfigured()) {
    const { mapping, confidence } = computeDynamicMappingWithCollisionPrevention(
      externalHeaders,
      targetFields,
      sampleRows
    );
    return { mapping, confidence, isAiPowered: false };
  }

  const sampleSnippet = sampleRows.slice(0, 3).map(row => {
    const cleaned: Record<string, any> = {};
    externalHeaders.forEach(h => {
      cleaned[h] = row[h];
    });
    return cleaned;
  });

  const prompt = `
You are an expert AI Data Mapping Engineer for AnalyzeUp.
Map external CSV columns to our internal target fields for a "${FILE_TYPE_DEFINITIONS[fileType].name}".

TARGET SCHEMA FIELDS FOR THIS FILE TYPE:
${targetFields.map(f => `- "${f.key}": ${f.label} (${f.description}) ${f.required ? '[REQUIRED]' : ''}`).join('\n')}

EXTERNAL CSV HEADERS:
${externalHeaders.join(', ')}

SAMPLE DATA:
${JSON.stringify(sampleSnippet, null, 2)}

INSTRUCTIONS:
1. Map each external header to the MOST RELEVANT target field key listed above.
2. CRITICAL RULES:
   - Do NOT map discount, tax, or numeric surcharge columns (like "Item Discount", "Item Tax", "Discount Amount") to "productName", "name", or "sellingPrice".
   - If a column contains numbers like 0.00, it is NOT a product name.
   - If a column does not match standard fields, map it to "customAttribute" so it can be stored directly in the database.
3. Provide confidence score (0.0 to 1.0) per column.

Respond ONLY with valid JSON.
{
  "mappings": { "CSV_Header": "target_key" },
  "confidence": { "CSV_Header": 0.95 }
}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an intelligent semantic data mapper.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const aiMap = parsed.mappings || {};
    const aiConf = parsed.confidence || {};

    // Validate and sanitize AI mappings through collision prevention and type checks
    const { mapping, confidence } = computeDynamicMappingWithCollisionPrevention(
      externalHeaders,
      targetFields,
      sampleRows,
      aiMap,
      aiConf
    );

    return { mapping, confidence, isAiPowered: true };
  } catch (error) {
    console.warn('AI Semantic Mapping Fallback:', error);
    const { mapping, confidence } = computeDynamicMappingWithCollisionPrevention(
      externalHeaders,
      targetFields,
      sampleRows
    );
    return { mapping, confidence, isAiPowered: false };
  }
}

interface ColumnProfile {
  header: string;
  normalized: string;
  isNumericColumn: boolean;
  isDateColumn: boolean;
}

function analyzeColumns(headers: string[], sampleRows: Record<string, any>[]): Record<string, ColumnProfile> {
  const profiles: Record<string, ColumnProfile> = {};

  headers.forEach(h => {
    let numericCount = 0;
    let dateCount = 0;
    let totalNonEmpty = 0;

    for (const row of sampleRows.slice(0, 15)) {
      const raw = row[h];
      if (raw === undefined || raw === null) continue;
      const str = String(raw).trim();
      if (!str || str === '—' || str === '-' || str === 'N/A' || str === 'null') continue;

      totalNonEmpty++;
      const cleanNumStr = str.replace(/,/g, '').replace(/[₹$€£%]/g, '').trim();
      if (!isNaN(Number(cleanNumStr)) && cleanNumStr.length > 0) {
        numericCount++;
      }
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(str)) {
        dateCount++;
      }
    }

    profiles[h] = {
      header: h,
      normalized: h.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(),
      isNumericColumn: totalNonEmpty > 0 && (numericCount / totalNonEmpty) >= 0.7,
      isDateColumn: totalNonEmpty > 0 && (dateCount / totalNonEmpty) >= 0.7,
    };
  });

  return profiles;
}

const PRIMARY_SINGLE_ASSIGNMENT_TARGETS = new Set([
  'productName',
  'name',
  'sellingPrice',
  'price',
  'costPrice',
  'unitCost',
  'quantity',
  'stock',
  'orderNumber',
  'sku',
  'discount',
  'tax',
  'customerName',
  'supplier',
  'supplierName',
  'category',
  'orderDate',
]);

export function computeDynamicMappingWithCollisionPrevention(
  externalHeaders: string[],
  targetFields: TargetFieldDef[],
  sampleRows: Record<string, any>[] = [],
  aiSuggestions: Record<string, string> = {},
  aiConfidence: Record<string, number> = {}
): { mapping: FieldMapping; confidence: Record<string, number> } {
  const profiles = analyzeColumns(externalHeaders, sampleRows);
  const targetFieldKeys = new Set(targetFields.map(f => f.key));

  interface ScoredCandidate {
    header: string;
    targetKey: string;
    score: number;
  }

  const candidates: ScoredCandidate[] = [];

  externalHeaders.forEach(header => {
    const profile = profiles[header] || {
      header,
      normalized: header.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(),
      isNumericColumn: false,
      isDateColumn: false,
    };

    // If AI provided a suggestion, check if it's safe and doesn't violate type constraints
    const aiTarget = aiSuggestions[header];
    if (aiTarget && targetFieldKeys.has(aiTarget)) {
      // Safety guard: do not allow numeric column to be productName
      const isDangerousProductName = (aiTarget === 'productName' || aiTarget === 'name') && profile.isNumericColumn;
      // Safety guard: do not allow discount/tax header to be sellingPrice
      const isDangerousPrice = (aiTarget === 'sellingPrice' || aiTarget === 'price') && (profile.normalized.includes('discount') || profile.normalized.includes('tax'));

      if (!isDangerousProductName && !isDangerousPrice) {
        const confScore = Math.round((aiConfidence[header] || 0.94) * 100);
        candidates.push({
          header,
          targetKey: aiTarget,
          score: Math.max(90, confScore),
        });
      }
    }

    // Evaluate against each schema field
    for (const field of targetFields) {
      if (field.key === 'skip') continue;
      const score = scoreHeaderMatch(profile, field.key, field.label);
      if (score >= 60) {
        candidates.push({
          header,
          targetKey: field.key,
          score,
        });
      }
    }
  });

  // Sort descending by match score
  candidates.sort((a, b) => b.score - a.score);

  const mapping: FieldMapping = {};
  const confidence: Record<string, number> = {};
  const assignedHeaders = new Set<string>();
  const assignedTargets = new Set<string>();

  // 1. Greedy 1-to-1 assignment of highest scoring matches
  for (const cand of candidates) {
    if (assignedHeaders.has(cand.header)) continue;
    if (PRIMARY_SINGLE_ASSIGNMENT_TARGETS.has(cand.targetKey) && assignedTargets.has(cand.targetKey)) {
      continue;
    }

    mapping[cand.header] = cand.targetKey;
    confidence[cand.header] = cand.score;
    assignedHeaders.add(cand.header);
    assignedTargets.add(cand.targetKey);
  }

  // 2. Fallback for unmapped headers: Map to customAttribute so everything is stored in the database!
  externalHeaders.forEach(header => {
    if (!mapping[header]) {
      mapping[header] = 'customAttribute';
      confidence[header] = 85;
    }
  });

  return { mapping, confidence };
}

function scoreHeaderMatch(profile: ColumnProfile, targetKey: string, targetLabel: string): number {
  const h = profile.normalized;
  const tokens = h.split(' ');
  const has = (word: string) => tokens.includes(word) || h.includes(word);

  const isDiscount = has('discount') || has('disc') || has('rebate') || has('coupon') || has('promo') || has('markdown') || has('offer');
  const isTax = has('tax') || has('gst') || has('vat') || has('duty') || has('cess') || has('surcharge');
  const isCost = has('cost') || has('purchase') || has('buying') || has('cogs') || has('buy price') || has('unit cost');
  const isPrice = has('price') || has('rate') || has('mrp') || has('selling') || has('retail') || has('sale');
  const isQty = has('qty') || has('quantity') || has('units') || has('pieces') || has('volume') || has('count');
  const isOrder = has('invoice') || has('order no') || has('order number') || has('order id') || has('bill no') || has('receipt') || has('inv no') || has('bill');
  const isCustomer = has('customer') || has('buyer') || has('client') || has('bill to') || has('sold to');
  const isSupplier = has('supplier') || has('vendor') || has('distributor') || has('wholesaler');
  const isSku = has('sku') || has('barcode') || has('item code') || has('product code') || has('article no') || has('upc') || has('ean');
  const isDate = has('date') || has('timestamp') || has('created');

  if (h === targetKey.toLowerCase() || h === targetLabel.toLowerCase()) return 100;

  switch (targetKey) {
    case 'productName':
    case 'name': {
      if (isDiscount || isTax || isCost || isPrice || isQty || isOrder || isCustomer || isSupplier || isSku || isDate || profile.isNumericColumn || profile.isDateColumn) {
        return 0;
      }
      if (h === 'product name' || h === 'product_name' || h === 'item name' || h === 'item_name') return 100;
      if (h === 'product title' || h === 'item title' || h === 'title') return 95;
      if (h === 'product' || h === 'item' || h === 'item description') return 90;
      if (h === 'description' || h === 'part name' || h === 'article') return 85;
      if (has('product') || has('title') || has('item')) return 75;
      return 0;
    }

    case 'sellingPrice':
    case 'price': {
      if (isDiscount || isTax || isCost || isQty || isOrder || isCustomer || isDate || profile.isDateColumn) {
        return 0;
      }
      if (h === 'selling price' || h === 'retail price' || h === 'unit price' || h === 'mrp' || h === 'sale price') return 100;
      if (h === 'price' || h === 'rate') return 95;
      if (has('selling') || has('retail') || has('mrp') || has('sale price')) return 90;
      if (h === 'amount' || h === 'unit rate' || h === 'price per unit') return 85;
      if (has('price') && !isCost && !isDiscount && !isTax) return 80;
      return 0;
    }

    case 'costPrice':
    case 'unitCost': {
      if (isDiscount || isTax || (isPrice && !isCost)) return 0;
      if (h === 'cost price' || h === 'purchase price' || h === 'unit cost' || h === 'buying price' || h === 'cogs') return 100;
      if (has('cost price') || has('purchase price') || has('unit cost') || has('buying price')) return 95;
      if (h === 'cost' || h === 'purchase') return 90;
      if (has('cost') || has('purchase')) return 80;
      return 0;
    }

    case 'discount': {
      if (!isDiscount) return 0;
      if (h === 'discount' || h === 'discount amount' || h === 'item discount' || h === 'disc amount') return 100;
      if (has('discount') || has('disc') || has('rebate')) return 90;
      return 70;
    }

    case 'tax': {
      if (!isTax) return 0;
      if (h === 'tax' || h === 'gst' || h === 'vat' || h === 'tax amount' || h === 'item tax') return 100;
      if (has('tax') || has('gst') || has('vat')) return 90;
      return 70;
    }

    case 'quantity': {
      if (isPrice || isCost || isDiscount || isTax) return 0;
      if (h === 'qty' || h === 'quantity' || h === 'qty sold' || h === 'units sold' || h === 'units') return 100;
      if (has('qty') || has('quantity') || has('units sold')) return 90;
      return 0;
    }

    case 'stock': {
      if (isPrice || isCost || isDiscount || isTax) return 0;
      if (h === 'current stock' || h === 'stock' || h === 'inventory' || h === 'units on hand' || h === 'available stock') return 100;
      if (has('stock') || has('inventory')) return 90;
      return 0;
    }

    case 'sku': {
      if (isPrice || isCost || isDiscount || isTax || isDate) return 0;
      if (h === 'sku' || h === 'item code' || h === 'product code' || h === 'barcode' || h === 'upc' || h === 'ean') return 100;
      if (has('sku') || has('barcode') || has('item code') || has('product code')) return 90;
      return 0;
    }

    case 'orderNumber':
    case 'orderId': {
      if (!isOrder) return 0;
      if (h === 'invoice no' || h === 'order no' || h === 'invoice number' || h === 'order number' || h === 'order id' || h === 'bill no') return 100;
      if (has('invoice') || has('order no') || has('bill no') || has('order id')) return 90;
      return 70;
    }

    case 'orderDate':
    case 'expectedDate': {
      if (targetKey === 'expectedDate' && (has('expected') || has('delivery') || has('arrival'))) return 95;
      if (isDate || profile.isDateColumn) {
        if (h === 'order date' || h === 'invoice date' || h === 'sale date' || h === 'bill date' || h === 'date') return 100;
        if (has('date') || has('timestamp')) return 90;
        return 75;
      }
      return 0;
    }

    case 'customerName':
    case 'customerId': {
      if (targetKey === 'customerId' && (has('customer id') || has('client id') || has('cust id'))) return 95;
      if (isCustomer) {
        if (h === 'customer name' || h === 'client name' || h === 'buyer name' || h === 'customer') return 100;
        if (has('customer') || has('buyer') || has('client')) return 90;
      }
      return 0;
    }

    case 'supplier':
    case 'supplierName':
    case 'supplierId': {
      if (targetKey === 'supplierId' && (has('supplier id') || has('vendor id') || has('sup id'))) return 95;
      if (isSupplier) {
        if (h === 'supplier' || h === 'vendor' || h === 'supplier name' || h === 'vendor name') return 100;
        if (has('supplier') || has('vendor') || has('distributor')) return 90;
      }
      return 0;
    }

    case 'category': {
      if (has('category') || has('department') || has('dept') || has('group') || has('product category')) return 95;
      return 0;
    }

    case 'brand': {
      if (has('brand') || has('maker') || has('label')) return 95;
      return 0;
    }

    case 'unit': {
      if (has('unit') || has('uom') || has('measure') || has('pack')) return 95;
      return 0;
    }

    case 'city': {
      if (has('warehouse') || has('city') || has('location') || has('destination') || has('branch')) return 95;
      return 0;
    }

    case 'paymentMode': {
      if (has('payment') || has('tender') || has('pay mode') || has('payment method') || has('gateway')) return 95;
      return 0;
    }

    case 'status': {
      if (has('status') || has('order status') || has('item status') || has('state') || has('fulfillment')) return 95;
      return 0;
    }

    case 'remarks': {
      if (has('remarks') || has('notes') || has('note') || has('comment') || has('comments')) return 95;
      return 0;
    }

    case 'minStock':
    case 'safetyStock': {
      if (targetKey === 'safetyStock' && has('safety stock')) return 95;
      if (has('reorder level') || has('reorder point') || has('min stock') || has('safety stock') || has('threshold')) return 90;
      return 0;
    }

    case 'leadTimeDays': {
      if (has('lead time') || has('lead days') || has('procurement days') || has('delivery days')) return 95;
      return 0;
    }

    case 'customAttribute': {
      return 10;
    }

    default:
      return 0;
  }
}

export function getFuzzyMatchForFileType(
  header: string,
  targetFields: TargetFieldDef[],
  sampleRows: Record<string, any>[] = []
): string {
  const result = computeDynamicMappingWithCollisionPrevention([header], targetFields, sampleRows);
  return result.mapping[header] || 'customAttribute';
}
