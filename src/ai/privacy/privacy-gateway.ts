/**
 * AI Privacy Layer & Gateway for AnalyzeUp
 * 
 * Minimizes sensitive company data sent to external AI providers (OpenAI).
 * Replaces identifiable names (Company, Product, Supplier, Customer) with opaque,
 * randomly generated tokens, scrubs PII, and resolves returned tokens locally.
 * 
 * Token mappings are strictly ephemeral, stored in local memory only, and never
 * transmitted over the network.
 */

import crypto from 'crypto';
import type { Product, Transaction, Supplier, PurchaseOrder, BusinessProfile } from '@/lib/types';

export type TokenType = 'COMPANY' | 'PRODUCT' | 'SUPPLIER' | 'CUSTOMER' | 'ORDER' | 'STORE';

export interface SanitizedProductMetric {
  id: string; // Token (e.g. PRODUCT_a83f21)
  name: string; // Token (e.g. PRODUCT_a83f21)
  sku: string; // Tokenized or generic
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock?: number;
  unit?: string;
  supplierToken?: string;
}

export interface SanitizedTransactionMetric {
  id: string; // Tokenized
  productToken: string;
  customerToken?: string;
  quantity: number;
  amount: number;
  type: string;
  date: string;
}

export interface SanitizedSupplierMetric {
  id: string; // Token (e.g. SUPPLIER_k83b1c)
  name: string; // Token
  category?: string;
  leadTimeDays?: number;
  defectRatePercent?: number;
}

/**
 * Generates an unpredictable, non-sequential token with a random hex suffix.
 */
function generateOpaqueToken(prefix: TokenType, length: number = 6): string {
  const randomSuffix = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  return `${prefix}_${randomSuffix}`;
}

/**
 * Regular expressions for common PII patterns
 */
const PII_PATTERNS = [
  // Email Addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/gi, replacement: '[EMAIL_REDACTED]' },
  // Indian Phone Numbers / International Phone Numbers
  { pattern: /(\+?\d{1,4}[-.\s]?)?(\(?\d{3,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
  // Indian GSTIN (15 Alphanumeric)
  { pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/g, replacement: '[GSTIN_REDACTED]' },
  // Indian PAN (10 Alphanumeric)
  { pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, replacement: '[PAN_REDACTED]' },
  // Credit / Debit Card Numbers (13-19 digits)
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g, replacement: '[CARD_REDACTED]' },
];

/**
 * Scrubs known PII patterns from text
 */
export function scrubPII(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Isolated Privacy Session.
 * Maintains local forward & reverse token mappings for the duration of an AI operation.
 */
export class AIPrivacySession {
  public readonly sessionId: string;
  private tokenToOriginal: Map<string, string> = new Map();
  private originalToToken: Map<string, string> = new Map();
  private disposed: boolean = false;

  constructor() {
    this.sessionId = crypto.randomBytes(4).toString('hex');
  }

  /**
   * Generates or retrieves an existing opaque token for a given sensitive value.
   */
  public tokenize(originalValue: string | null | undefined, type: TokenType): string {
    if (this.disposed) {
      throw new Error('[AIPrivacySession] Cannot tokenize on a disposed privacy session.');
    }
    if (!originalValue || typeof originalValue !== 'string') {
      return '';
    }

    const trimmed = originalValue.trim();
    if (!trimmed) return '';

    const cacheKey = `${type}:${trimmed}`;
    const existing = this.originalToToken.get(cacheKey);
    if (existing) {
      return existing;
    }

    // Generate unique random token (ensure collision resistance)
    let token: string;
    do {
      token = generateOpaqueToken(type);
    } while (this.tokenToOriginal.has(token));

    this.originalToToken.set(cacheKey, token);
    this.tokenToOriginal.set(token, trimmed);
    return token;
  }

  /**
   * Resolves a token back to its original internal value.
   */
  public detokenize(token: string): string {
    if (!token || typeof token !== 'string') return token;
    return this.tokenToOriginal.get(token) || token;
  }

  /**
   * Sanitizes a business company profile
   */
  public sanitizeCompany(profile?: BusinessProfile | null): { companyToken: string; industry: string; currency: string } {
    const rawName = profile?.businessName || profile?.shopifyStoreName || 'Store';
    const token = this.tokenize(rawName, 'COMPANY');
    return {
      companyToken: token,
      industry: profile?.businessType || 'Retail & E-Commerce',
      currency: profile?.currency || 'INR',
    };
  }

  /**
   * Sanitizes a product catalog into numeric metrics and tokens.
   */
  public sanitizeProducts(products: Product[] = []): SanitizedProductMetric[] {
    return products.map((p) => {
      const nameToken = this.tokenize(p.name, 'PRODUCT');
      const idToken = this.tokenize(p.id, 'PRODUCT');
      const supplierToken = p.supplier ? this.tokenize(p.supplier, 'SUPPLIER') : undefined;

      return {
        id: idToken,
        name: nameToken,
        sku: p.sku ? `SKU_${this.tokenize(p.sku, 'PRODUCT').replace('PRODUCT_', '')}` : 'SKU_STANDARD',
        category: scrubPII(p.category || 'General'),
        price: Number(p.price) || 0,
        costPrice: Number(p.costPrice) || (Number(p.price) || 0) * 0.6,
        stock: Number(p.stock) || 0,
        minStock: Number(p.minStock) || 5,
        unit: p.unit || 'pcs',
        supplierToken,
      };
    });
  }

  /**
   * Sanitizes transactions into anonymous sales metrics.
   */
  public sanitizeTransactions(transactions: Transaction[] = []): SanitizedTransactionMetric[] {
    return transactions.map((t) => {
      const productToken = this.tokenize(t.productName || (t as any).name || 'Item', 'PRODUCT');
      const customerToken = t.customerName ? this.tokenize(t.customerName, 'CUSTOMER') : undefined;
      const txAmount = Number(t.totalRevenue) || Number(t.price) || 0;
      const txDate = typeof t.transactionDate === 'string' ? t.transactionDate : new Date().toISOString();

      return {
        id: this.tokenize(t.id, 'ORDER'),
        productToken,
        customerToken,
        quantity: Number(t.quantity) || 1,
        amount: txAmount,
        type: t.type || 'Sale',
        date: txDate,
      };
    });
  }

  /**
   * Sanitizes prompt text by replacing known sensitive terms and scrubbing PII.
   */
  public sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let sanitized = scrubPII(text);

    // Replace any known original values with their tokens
    for (const [cacheKey, token] of this.originalToToken.entries()) {
      const originalValue = cacheKey.substring(cacheKey.indexOf(':') + 1);
      if (originalValue.length > 2) {
        // Escape special regex characters
        const escaped = originalValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        sanitized = sanitized.replace(regex, token);
      }
    }

    return sanitized;
  }

  /**
   * Detokenizes a string returned from OpenAI, restoring all original names.
   */
  public detokenizeText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let result = text;

    for (const [token, original] of this.tokenToOriginal.entries()) {
      const regex = new RegExp(`\\b${token}\\b`, 'g');
      result = result.replace(regex, original);
    }

    return result;
  }

  /**
   * Recursively traverses and detokenizes any nested object or array.
   */
  public detokenizeObject<T>(data: T): T {
    if (!data) return data;

    if (typeof data === 'string') {
      return this.detokenizeText(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.detokenizeObject(item)) as unknown as T;
    }

    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.detokenizeObject(value);
      }
      return result as T;
    }

    return data;
  }

  /**
   * Purges all internal mapping tables from memory.
   */
  public dispose(): void {
    this.tokenToOriginal.clear();
    this.originalToToken.clear();
    this.disposed = true;
  }
}

/**
 * Wraps an async AI operation in an isolated Privacy Session with guaranteed cleanup.
 */
export async function withPrivacySession<T>(
  handler: (session: AIPrivacySession) => Promise<T>
): Promise<T> {
  const session = new AIPrivacySession();
  try {
    return await handler(session);
  } finally {
    session.dispose();
  }
}
