import { describe, it, expect } from 'vitest';
import { INDUSTRY_CONFIGS } from '@/lib/industry-intelligence';
import { BusinessType, BusinessSize } from '@/lib/types';

describe('Settings Business Profile Save Enforcement', () => {
  const defaultSavedProfile = {
    businessName: 'My Store',
    businessType: 'Retail' as BusinessType,
    businessSize: '2-10 Employees' as BusinessSize,
    currency: 'INR (₹)',
    country: 'India',
    logoUrl: 'https://example.com/logo.png',
  };

  const computeHasChanges = (
    formState: typeof defaultSavedProfile,
    savedProfile: typeof defaultSavedProfile
  ) => {
    return (
      formState.businessName.trim() !== savedProfile.businessName.trim() ||
      formState.businessType !== savedProfile.businessType ||
      formState.businessSize !== savedProfile.businessSize ||
      formState.currency !== savedProfile.currency ||
      formState.country !== savedProfile.country ||
      formState.logoUrl !== savedProfile.logoUrl
    );
  };

  it('reports NO unsaved changes when form state matches saved profile', () => {
    const hasChanges = computeHasChanges(defaultSavedProfile, defaultSavedProfile);
    expect(hasChanges).toBe(false);
  });

  it('detects unsaved changes when business type is changed without saving', () => {
    const modifiedForm = {
      ...defaultSavedProfile,
      businessType: 'Restaurant' as BusinessType,
    };
    const hasChanges = computeHasChanges(modifiedForm, defaultSavedProfile);
    expect(hasChanges).toBe(true);

    // Active AI context should remain the saved profile type until saved
    const activeContext = INDUSTRY_CONFIGS[defaultSavedProfile.businessType]?.aiPriority;
    const pendingContext = INDUSTRY_CONFIGS[modifiedForm.businessType]?.aiPriority;

    expect(activeContext).toContain('cash cows');
    expect(pendingContext).toContain('high-perishable ingredients');
    expect(activeContext).not.toEqual(pendingContext);
  });

  it('detects unsaved changes when logo is staged or cleared without saving', () => {
    const stagedLogoForm = {
      ...defaultSavedProfile,
      logoUrl: 'data:image/webp;base64,staged_image_data',
    };
    expect(computeHasChanges(stagedLogoForm, defaultSavedProfile)).toBe(true);

    const clearedLogoForm = {
      ...defaultSavedProfile,
      logoUrl: '',
    };
    expect(computeHasChanges(clearedLogoForm, defaultSavedProfile)).toBe(true);
  });

  it('detects unsaved changes when business name, currency, or team size change', () => {
    expect(computeHasChanges({ ...defaultSavedProfile, businessName: 'Brand New Store' }, defaultSavedProfile)).toBe(true);
    expect(computeHasChanges({ ...defaultSavedProfile, currency: 'USD ($)' }, defaultSavedProfile)).toBe(true);
    expect(computeHasChanges({ ...defaultSavedProfile, businessSize: '50+' }, defaultSavedProfile)).toBe(true);
  });

  it('returns to clean in-sync state once changes are committed', () => {
    const newlySaved = {
      ...defaultSavedProfile,
      businessType: 'Fashion' as BusinessType,
      businessName: 'Fashion Hub',
    };

    // After clicking Save Business Profile, the active profile updates to the newly saved profile
    const hasChanges = computeHasChanges(newlySaved, newlySaved);
    expect(hasChanges).toBe(false);

    const activeContext = INDUSTRY_CONFIGS[newlySaved.businessType]?.aiPriority;
    expect(activeContext).toContain('seasonal inventory cycles');
  });
});
