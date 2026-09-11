import { describe, it, expect } from 'vitest';
import {
  formatTime12h,
  formatShopifyScheduleSummary,
  getNextShopifySyncDisplay,
  formatShopifyLastSync,
  isShopifyAutoSyncDue,
} from './shopify-sync-helper';

describe('Shopify Sync Helper Utilities', () => {
  it('formats 24-hour time strings into 12-hour AM/PM', () => {
    expect(formatTime12h('09:00')).toBe('9:00 AM');
    expect(formatTime12h('14:30')).toBe('2:30 PM');
    expect(formatTime12h('00:15')).toBe('12:15 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  it('formats schedule summaries correctly', () => {
    expect(formatShopifyScheduleSummary(null)).toBe('Manual Sync Only');
    expect(
      formatShopifyScheduleSummary({
        shopifyRealtimeSyncEnabled: true,
        shopifyAutoSyncEnabled: false,
      })
    ).toBe('Real-Time (Instant on Event)');

    expect(
      formatShopifyScheduleSummary({
        shopifyRealtimeSyncEnabled: true,
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: 'daily',
        shopifySyncTime: '09:00',
      })
    ).toBe('Real-Time + Daily at 9:00 AM');

    expect(
      formatShopifyScheduleSummary({
        shopifyRealtimeSyncEnabled: false,
        shopifyAutoSyncEnabled: false,
      })
    ).toBe('Manual Sync Only');

    expect(
      formatShopifyScheduleSummary({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: '1_min',
      })
    ).toBe('Every 1 Minute');

    expect(
      formatShopifyScheduleSummary({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: '15_mins',
      })
    ).toBe('Every 15 Minutes');

    expect(
      formatShopifyScheduleSummary({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: 'daily',
        shopifySyncTime: '15:45',
      })
    ).toBe('Daily at 3:45 PM');

    expect(
      formatShopifyScheduleSummary({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: 'custom_datetime',
        shopifyScheduledDateTime: '2026-10-15T14:30:00.000Z',
      })
    ).toContain('Date:');
  });

  it('displays next sync information accurately', () => {
    expect(
      getNextShopifySyncDisplay({
        shopifyRealtimeSyncEnabled: true,
      })
    ).toContain('Live Active');

    expect(
      getNextShopifySyncDisplay({
        shopifyAutoSyncEnabled: false,
      })
    ).toBe('Auto-sync is currently paused');

    expect(
      getNextShopifySyncDisplay({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: '1_min',
      })
    ).toBe('Within 1 minute');

    expect(
      getNextShopifySyncDisplay({
        shopifyAutoSyncEnabled: true,
        shopifySyncFrequency: '15_mins',
      })
    ).toBe('Within 15 minutes');
  });

  it('formats last sync timestamp with relative days', () => {
    expect(formatShopifyLastSync(null)).toBe('Never synced yet');
    expect(formatShopifyLastSync('invalid-date')).toBe('Never synced yet');

    const now = new Date();
    expect(formatShopifyLastSync(now.toISOString())).toContain('Today at');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatShopifyLastSync(yesterday.toISOString())).toContain('Yesterday at');
  });

  describe('isShopifyAutoSyncDue', () => {
    const baseProfile = {
      shopifyConnected: true,
      shopifyStoreUrl: 'test-store.myshopify.com',
      shopifyAccessToken: 'shpat_test123',
      shopifyAutoSyncEnabled: true,
    };

    it('returns false if store is not connected or credentials missing', () => {
      expect(isShopifyAutoSyncDue({ ...baseProfile, shopifyConnected: false })).toBe(false);
      expect(isShopifyAutoSyncDue({ ...baseProfile, shopifyAccessToken: '' })).toBe(false);
      expect(isShopifyAutoSyncDue({ ...baseProfile, shopifyAutoSyncEnabled: false })).toBe(false);
    });

    it('enforces 15-second minimum cooldown', () => {
      const justNow = new Date(Date.now() - 5 * 1000).toISOString();
      expect(
        isShopifyAutoSyncDue({
          ...baseProfile,
          shopifyLastSyncedAt: justNow,
          shopifySyncFrequency: '1_min',
        })
      ).toBe(false);
    });

    it('returns true when 1_min interval has elapsed', () => {
      const past70s = new Date(Date.now() - 70 * 1000).toISOString();
      expect(
        isShopifyAutoSyncDue({
          ...baseProfile,
          shopifyLastSyncedAt: past70s,
          shopifySyncFrequency: '1_min',
        })
      ).toBe(true);
    });

    it('returns true when recurring interval has elapsed', () => {
      const past16Mins = new Date(Date.now() - 16 * 60 * 1000).toISOString();
      expect(
        isShopifyAutoSyncDue({
          ...baseProfile,
          shopifyLastSyncedAt: past16Mins,
          shopifySyncFrequency: '15_mins',
        })
      ).toBe(true);
    });

    it('evaluates custom date & time schedule correctly', () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const lastSyncBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      expect(
        isShopifyAutoSyncDue({
          ...baseProfile,
          shopifySyncFrequency: 'custom_datetime',
          shopifyScheduledDateTime: pastTime,
          shopifyLastSyncedAt: lastSyncBefore,
        })
      ).toBe(true);

      const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(
        isShopifyAutoSyncDue({
          ...baseProfile,
          shopifySyncFrequency: 'custom_datetime',
          shopifyScheduledDateTime: futureTime,
          shopifyLastSyncedAt: lastSyncBefore,
        })
      ).toBe(false);
    });
  });
});
