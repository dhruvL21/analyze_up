import { describe, it, expect } from 'vitest';

function cleanShopDomain(input: string): string {
  let clean = input.trim().toLowerCase();
  const adminMatch = clean.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9\-]+)/);
  if (adminMatch && adminMatch[1]) {
    return `${adminMatch[1]}.myshopify.com`;
  }
  clean = clean.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!clean.includes('.myshopify.com')) {
    clean = `${clean}.myshopify.com`;
  }
  return clean;
}

function isPilotAuthorizedStore(input: string): boolean {
  const clean = cleanShopDomain(input);
  return (
    clean === 'snkhed.myshopify.com' ||
    clean === '14aj1c-0a.myshopify.com' ||
    clean.startsWith('snkhed.') ||
    clean.startsWith('14aj1c-0a.')
  );
}

describe('Shopify Pilot Authorized Store Gating', () => {
  it('allows the primary pilot store snkhed.myshopify.com in all formats', () => {
    expect(isPilotAuthorizedStore('snkhed.myshopify.com')).toBe(true);
    expect(isPilotAuthorizedStore('https://snkhed.myshopify.com')).toBe(true);
    expect(isPilotAuthorizedStore('https://snkhed.myshopify.com/admin')).toBe(true);
    expect(isPilotAuthorizedStore('snkhed')).toBe(true);
    expect(isPilotAuthorizedStore('SNKHED.MYSHOPIFY.COM')).toBe(true);
  });

  it('allows the Shopify internal development handle 14aj1c-0a.myshopify.com', () => {
    expect(isPilotAuthorizedStore('14aj1c-0a.myshopify.com')).toBe(true);
    expect(isPilotAuthorizedStore('https://14aj1c-0a.myshopify.com/')).toBe(true);
    expect(isPilotAuthorizedStore('14aj1c-0a')).toBe(true);
  });

  it('blocks non-pilot stores and triggers the review modal message', () => {
    expect(isPilotAuthorizedStore('nike.myshopify.com')).toBe(false);
    expect(isPilotAuthorizedStore('my-fashion-boutique')).toBe(false);
    expect(isPilotAuthorizedStore('https://coolstore.myshopify.com')).toBe(false);
    expect(isPilotAuthorizedStore('test-store.myshopify.com')).toBe(false);
  });
});
