/**
 * Shopify Synchronization & Schedule Helpers
 * Provides utilities for real-time live sync, scheduled interval calculations,
 * and human-friendly time displays.
 */

export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '9:00 AM';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const min = parts[1].padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${ampm}`;
}

export function formatShopifyScheduleSummary(profile?: any): string {
  if (!profile) return 'Manual Sync Only';

  const hasRealtime = Boolean(profile.shopifyRealtimeSyncEnabled);
  const hasScheduled = Boolean(profile.shopifyAutoSyncEnabled);

  const freq = profile.shopifySyncFrequency || 'daily';
  const time = formatTime12h(profile.shopifySyncTime || '09:00');
  const day = profile.shopifySyncDay
    ? profile.shopifySyncDay.charAt(0).toUpperCase() + profile.shopifySyncDay.slice(1)
    : 'Monday';

  let scheduledText = '';
  if (freq === 'custom_datetime') {
    if (profile.shopifyScheduledDateTime) {
      try {
        const d = new Date(profile.shopifyScheduledDateTime);
        if (!isNaN(d.getTime())) {
          scheduledText = `Date: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }
      } catch {
        scheduledText = 'Set Date & Time';
      }
    } else {
      scheduledText = 'Set Date & Time';
    }
  } else {
    switch (freq) {
      case '1_min':
        scheduledText = 'Every 1 Minute';
        break;
      case '5_mins':
        scheduledText = 'Every 5 Minutes';
        break;
      case '15_mins':
        scheduledText = 'Every 15 Minutes';
        break;
      case '30_mins':
        scheduledText = 'Every 30 Minutes';
        break;
      case '1_hour':
        scheduledText = 'Every 1 Hour';
        break;
      case '6_hours':
        scheduledText = 'Every 6 Hours';
        break;
      case '12_hours':
        scheduledText = 'Every 12 Hours';
        break;
      case 'weekly':
        scheduledText = `Weekly (${day} ${time})`;
        break;
      case 'daily':
      default:
        scheduledText = `Daily at ${time}`;
        break;
    }
  }

  if (hasRealtime && hasScheduled && freq !== 'realtime') {
    return `Real-Time + ${scheduledText}`;
  }

  if (hasRealtime) {
    return 'Real-Time (Instant on Event)';
  }

  if (!hasScheduled) {
    return 'Manual Sync Only';
  }

  return scheduledText || `Daily at ${time}`;
}

export function getNextShopifySyncDisplay(profile?: any): string {
  if (!profile) return 'Not configured';

  const hasRealtime = Boolean(profile.shopifyRealtimeSyncEnabled);
  if (hasRealtime) {
    return 'Live Active (Checking every 15s + on change)';
  }

  if (profile.shopifyAutoSyncEnabled === false) {
    return 'Auto-sync is currently paused';
  }

  const freq = profile.shopifySyncFrequency || 'daily';

  if (freq === 'custom_datetime' && profile.shopifyScheduledDateTime) {
    try {
      const target = new Date(profile.shopifyScheduledDateTime);
      const now = new Date();
      if (isNaN(target.getTime())) return 'Invalid scheduled date';
      if (target <= now) return 'Due now (will sync on next check)';
      return `${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } catch {
      return 'Scheduled custom date';
    }
  }

  if (freq === 'realtime') {
    return 'Live Active (Checking every 15s)';
  }
  if (freq === '1_min') {
    return 'Within 1 minute';
  }
  if (freq === '5_mins') {
    return 'Within 5 minutes';
  }
  if (freq === '15_mins') {
    return 'Within 15 minutes';
  }
  if (freq === '30_mins') {
    return 'Within 30 minutes';
  }
  if (freq === '1_hour') {
    return 'Within 1 hour';
  }
  if (freq === '6_hours') {
    return 'Every 6 hours';
  }
  if (freq === '12_hours') {
    return 'Every 12 hours';
  }

  const timeStr = profile.shopifySyncTime || '09:00';
  const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
  const now = new Date();

  if (freq === 'daily') {
    const next = new Date();
    next.setHours(targetH, targetM, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
      return `Tomorrow at ${formatTime12h(timeStr)}`;
    }
    return `Today at ${formatTime12h(timeStr)}`;
  }

  if (freq === 'weekly') {
    const dayDisplay = profile.shopifySyncDay
      ? profile.shopifySyncDay.charAt(0).toUpperCase() + profile.shopifySyncDay.slice(1)
      : 'Monday';
    return `Every ${dayDisplay} at ${formatTime12h(timeStr)}`;
  }

  return `Daily at ${formatTime12h(timeStr)}`;
}

export function formatShopifyLastSync(lastSyncAt?: string | null): string {
  if (!lastSyncAt) return 'Never synced yet';
  try {
    const date = new Date(lastSyncAt);
    if (isNaN(date.getTime())) return 'Never synced yet';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }
    if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    }
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
  } catch {
    return 'Never synced yet';
  }
}

export function isShopifyAutoSyncDue(profile?: any): boolean {
  if (
    !profile ||
    !profile.shopifyConnected ||
    !profile.shopifyStoreUrl
  ) {
    return false;
  }

  // If accessToken is explicitly defined but empty string, credentials are invalid
  if (profile.shopifyAccessToken !== undefined && !String(profile.shopifyAccessToken).trim()) {
    return false;
  }

  const isRealtimeActive = Boolean(profile.shopifyRealtimeSyncEnabled) || profile.shopifySyncFrequency === 'realtime';
  const isScheduledActive = profile.shopifyAutoSyncEnabled === false ? false : Boolean(profile.shopifyAutoSyncEnabled);

  if (!isRealtimeActive && !isScheduledActive) {
    return false;
  }

  const lastSync = profile.shopifyLastSyncedAt
    ? new Date(profile.shopifyLastSyncedAt).getTime()
    : 0;
  const now = Date.now();
  const elapsedMs = now - lastSync;

  // 15-second minimum cooldown between auto-sync runs
  if (elapsedMs < 15 * 1000) {
    return false;
  }

  // If scheduled auto-sync is disabled, only real-time checks apply
  if (!isScheduledActive && isRealtimeActive) {
    return !lastSync || elapsedMs >= 15 * 1000;
  }

  // 1. Pure Real-Time live sync mode (checks every 15s or immediately if never synced)
  if (isRealtimeActive && (!profile.shopifySyncFrequency || profile.shopifySyncFrequency === 'realtime')) {
    return !lastSync || elapsedMs >= 15 * 1000;
  }

  const freq = profile.shopifySyncFrequency || 'daily';

  // 2. Specific Date & Time Sync
  if (freq === 'custom_datetime') {
    if (!profile.shopifyScheduledDateTime) return false;
    const scheduledTime = new Date(profile.shopifyScheduledDateTime).getTime();
    if (isNaN(scheduledTime)) return false;

    return now >= scheduledTime && lastSync < scheduledTime;
  }

  // 3. Fast recurring intervals
  if (freq === '1_min') {
    return !lastSync || elapsedMs >= 60 * 1000;
  }
  if (freq === '5_mins') {
    return !lastSync || elapsedMs >= 5 * 60 * 1000;
  }
  if (freq === '15_mins') {
    return !lastSync || elapsedMs >= 15 * 60 * 1000;
  }
  if (freq === '30_mins') {
    return !lastSync || elapsedMs >= 30 * 60 * 1000;
  }
  if (freq === '1_hour') {
    return !lastSync || elapsedMs >= 60 * 60 * 1000;
  }
  if (freq === '6_hours') {
    return !lastSync || elapsedMs >= 6 * 60 * 60 * 1000;
  }
  if (freq === '12_hours') {
    return !lastSync || elapsedMs >= 12 * 60 * 60 * 1000;
  }

  // 4. Real-time active alongside daily/weekly recurring schedule
  if (isRealtimeActive) {
    return !lastSync || elapsedMs >= 15 * 1000;
  }

  // 3. Daily sync at set time
  if (freq === 'daily') {
    if (!lastSync) return true;
    const timeStr = profile.shopifySyncTime || '09:00';
    const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
    const targetToday = new Date();
    targetToday.setHours(targetH, targetM, 0, 0);
    const targetTime = targetToday.getTime();

    if (now >= targetTime && lastSync < targetTime) {
      return true;
    }
    return false;
  }

  // 4. Weekly sync at set day and time
  if (freq === 'weekly') {
    if (!lastSync) return true;
    const targetDay = (profile.shopifySyncDay || 'monday').toLowerCase();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = daysOfWeek[new Date().getDay()];

    if (currentDayName === targetDay) {
      const timeStr = profile.shopifySyncTime || '09:00';
      const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
      const targetToday = new Date();
      targetToday.setHours(targetH, targetM, 0, 0);
      const targetTime = targetToday.getTime();

      if (now >= targetTime && lastSync < targetTime) {
        return true;
      }
    }
    return false;
  }

  return false;
}
