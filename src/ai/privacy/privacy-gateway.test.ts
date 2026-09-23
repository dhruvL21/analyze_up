import { describe, it, expect } from 'vitest';
import { AIPrivacySession, scrubPII, withPrivacySession } from './privacy-gateway';

describe('AIPrivacyGateway & Session Suite', () => {
  it('generates unpredictable opaque tokens with non-sequential values', () => {
    const session = new AIPrivacySession();
    const token1 = session.tokenize('Nike Air Max', 'PRODUCT');
    const token2 = session.tokenize('Adidas Ultraboost', 'PRODUCT');
    const token3 = session.tokenize('Nike Air Max', 'PRODUCT'); // Same entity

    expect(token1).toMatch(/^PRODUCT_[0-9a-f]{6}$/);
    expect(token2).toMatch(/^PRODUCT_[0-9a-f]{6}$/);
    expect(token1).not.toBe(token2);
    expect(token1).toBe(token3); // Same entity resolves to consistent token within session

    session.dispose();
  });

  it('scrubs PII such as emails, phone numbers, and IDs', () => {
    const raw = 'Contact supplier at vendor@surattextiles.com or call +91-9876543210. GSTIN: 22AAAAA0000A1Z5';
    const scrubbed = scrubPII(raw);

    expect(scrubbed).toContain('[EMAIL_REDACTED]');
    expect(scrubbed).toContain('[PHONE_REDACTED]');
    expect(scrubbed).toContain('[GSTIN_REDACTED]');
    expect(scrubbed).not.toContain('vendor@surattextiles.com');
    expect(scrubbed).not.toContain('9876543210');
  });

  it('sanitizes product catalog and detokenizes AI completion response cleanly', () => {
    const session = new AIPrivacySession();
    const mockProducts = [
      { id: 'p1', name: 'Leather Oxford Shoes', price: 4999, costPrice: 2500, stock: 12, category: 'Footwear' },
      { id: 'p2', name: 'Silk Necktie', price: 999, costPrice: 400, stock: 50, category: 'Accessories' },
    ];

    const sanitized = session.sanitizeProducts(mockProducts as any);
    expect(sanitized[0].name).toMatch(/^PRODUCT_[0-9a-f]{6}$/);
    expect(sanitized[0].name).not.toContain('Leather Oxford Shoes');

    // Simulate OpenAI response referencing the tokenized IDs and names
    const fakeOpenAiResponse = {
      recommendedAction: `Reorder 25 units of ${sanitized[0].name} due to imminent stockout.`,
      forecasts: [
        { product: sanitized[0].name, predictedDemand: 35 },
        { product: sanitized[1].name, predictedDemand: 10 },
      ],
    };

    const detokenized = session.detokenizeObject(fakeOpenAiResponse);

    expect(detokenized.recommendedAction).toBe('Reorder 25 units of Leather Oxford Shoes due to imminent stockout.');
    expect(detokenized.forecasts[0].product).toBe('Leather Oxford Shoes');
    expect(detokenized.forecasts[1].product).toBe('Silk Necktie');

    session.dispose();
  });

  it('handles withPrivacySession wrapper and purges mappings on completion', async () => {
    let capturedSession: AIPrivacySession | null = null;

    const result = await withPrivacySession(async (session) => {
      capturedSession = session;
      const t = session.tokenize('Acme Corp', 'COMPANY');
      return session.detokenizeText(`Welcome to ${t}!`);
    });

    expect(result).toBe('Welcome to Acme Corp!');
    expect(() => capturedSession?.tokenize('Test', 'PRODUCT')).toThrow();
  });
});
