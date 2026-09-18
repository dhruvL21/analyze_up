import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function getValidAccessToken(userId: string, firestore: any): Promise<string | null> {
  const cleanUserId = userId && String(userId).trim();
  if (!cleanUserId || !firestore) return null;
  const connectionRef = doc(firestore, 'users', cleanUserId, 'integrations', 'google-drive');
  const snap = await getDoc(connectionRef);
  
  if (!snap.exists()) return null;
  
  const data = snap.data();
  if (data.connectionStatus !== 'Connected' || data.isConnected === false) return null;
  
  const { accessToken, refreshToken, tokenExpiry } = data;
  
  // If token is still valid (with a 2-minute buffer) and present, return it
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 120000) {
    return accessToken;
  }
  
  if (!refreshToken) {
    console.warn('Refresh token missing for user:', cleanUserId);
    return null;
  }
  
  // Refresh token request via backend route handler
  try {
    const res = await fetch('/api/drive/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!res.ok) {
      console.error('Failed to refresh Google token:', await res.json().catch(() => ({})));
      return null;
    }
    
    const tokenData = await res.json();
    const newAccessToken = tokenData.accessToken;
    const expiresIn = tokenData.expiresIn || 3600;
    
    await updateDoc(connectionRef, {
      accessToken: newAccessToken,
      tokenExpiry: Date.now() + expiresIn * 1000,
      connectionStatus: 'Connected',
      updatedAt: new Date().toISOString(),
    });
    
    return newAccessToken;
  } catch (err) {
    console.error('Error refreshing token:', err);
    return null;
  }
}

/**
 * Client-side helper to get a valid Google Drive access token.
 * Refreshes the token via /api/drive/refresh if expired and updates Firestore directly from the authenticated client.
 */
export async function getClientDriveToken(driveConnection: any, user: any, firestore: any): Promise<string | null> {
  if (!driveConnection || driveConnection.connectionStatus !== 'Connected' || driveConnection.isConnected === false) return null;
  const { accessToken, refreshToken, tokenExpiry } = driveConnection;

  // If token is still valid (with a 2-minute buffer) and present, return it
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 120000) {
    return accessToken;
  }

  if (!refreshToken) {
    console.warn('Refresh token missing for Google Drive connection');
    return null;
  }

  try {
    const res = await fetch('/api/drive/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      console.error('Failed to refresh Google token via API route');
      return null;
    }

    const tokenData = await res.json();
    const newAccessToken = tokenData.accessToken;
    const expiresIn = tokenData.expiresIn || 3600;

    const cleanUid = user?.uid && String(user.uid).trim();
    if (cleanUid && firestore) {
      const connectionRef = doc(firestore, 'users', cleanUid, 'integrations', 'google-drive');
      await updateDoc(connectionRef, {
        accessToken: newAccessToken,
        tokenExpiry: Date.now() + expiresIn * 1000,
        connectionStatus: 'Connected',
        updatedAt: new Date().toISOString(),
      });
    }

    return newAccessToken;
  } catch (err) {
    console.error('Error refreshing client drive token:', err);
    return null;
  }
}

/**
 * Format 24-hr time string (e.g. "09:00", "18:30") to 12-hr format (e.g. "9:00 AM", "6:30 PM")
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

/**
 * Summarize user's Google Drive auto-sync schedule
 */
export function formatScheduleSummary(connection: any): string {
  if (!connection || connection.autoSyncEnabled === false) {
    return 'Paused';
  }

  const freq = connection.autoSyncFrequency || 'daily';
  const time = formatTime12h(connection.autoSyncTime || '09:00');
  const day = connection.autoSyncDay ? connection.autoSyncDay.charAt(0).toUpperCase() + connection.autoSyncDay.slice(1) : 'Monday';

  switch (freq) {
    case '1_hour':
      return 'Every 1 Hour';
    case '6_hours':
      return 'Every 6 Hours';
    case '12_hours':
      return 'Every 12 Hours';
    case 'weekly':
      return `Weekly (${day} ${time})`;
    case 'daily':
    default:
      return `Daily at ${time}`;
  }
}

/**
 * Calculate human-friendly next sync schedule run time
 */
export function getNextSyncTimeDisplay(connection: any): string {
  if (!connection || connection.autoSyncEnabled === false) {
    return 'Auto-sync is currently paused';
  }

  const freq = connection.autoSyncFrequency || 'daily';
  const timeStr = connection.autoSyncTime || '09:00';
  const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);

  const now = new Date();

  if (freq === '1_hour') {
    return 'Within the next hour';
  }
  if (freq === '6_hours') {
    return 'Every 6 hours';
  }
  if (freq === '12_hours') {
    return 'Every 12 hours';
  }

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
    const dayDisplay = connection.autoSyncDay ? connection.autoSyncDay.charAt(0).toUpperCase() + connection.autoSyncDay.slice(1) : 'Monday';
    
    return `Every ${dayDisplay} at ${formatTime12h(timeStr)}`;
  }

  return `Daily at ${formatTime12h(timeStr)}`;
}

/**
 * Human-friendly last sync time display
 */
export function formatLastSyncTime(lastSyncAt?: string | null): string {
  if (!lastSyncAt) return 'Never synced yet';
  try {
    const date = new Date(lastSyncAt);
    if (isNaN(date.getTime())) return 'Never synced yet';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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

/**
 * Checks if auto-sync is due based on lastSyncAt, schedule configuration, and schedule updates
 */
export function isAutoSyncDue(connection: any): boolean {
  if (
    !connection ||
    connection.autoSyncEnabled !== true ||
    connection.connectionStatus !== 'Connected' ||
    connection.isConnected === false ||
    !connection.selectedFolderId
  ) {
    return false;
  }

  const lastSync = connection.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : 0;
  const now = Date.now();
  const elapsedMs = now - lastSync;
  const freq = connection.autoSyncFrequency || 'daily';

  // Never synced yet -> due immediately
  if (!lastSync) {
    return true;
  }

  // Minimum 1-minute cooldown between automated background syncs
  if (elapsedMs < 60 * 1000) {
    return false;
  }

  if (freq === '1_hour') {
    return elapsedMs >= 60 * 60 * 1000;
  }
  if (freq === '6_hours') {
    return elapsedMs >= 6 * 60 * 60 * 1000;
  }
  if (freq === '12_hours') {
    return elapsedMs >= 12 * 60 * 60 * 1000;
  }

  if (freq === 'daily') {
    const timeStr = connection.autoSyncTime || '09:00';
    const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
    const targetToday = new Date();
    targetToday.setHours(targetH, targetM, 0, 0);
    const targetTime = targetToday.getTime();

    // 1. Current time is past today's scheduled time and last sync was before today's scheduled time
    if (now >= targetTime && lastSync < targetTime) {
      return true;
    }

    // 2. Schedule settings were updated after the last sync and the target time for today has passed
    const settingsUpdated = connection.updatedAt ? new Date(connection.updatedAt).getTime() : 0;
    if (settingsUpdated > lastSync && now >= targetTime) {
      return true;
    }

    // 3. More than 24 hours have elapsed since the last sync
    if (elapsedMs >= 24 * 60 * 60 * 1000) {
      return true;
    }
  }

  if (freq === 'weekly') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[new Date().getDay()];
    const targetDay = (connection.autoSyncDay || 'monday').toLowerCase();

    if (currentDay === targetDay) {
      const timeStr = connection.autoSyncTime || '09:00';
      const [targetH, targetM] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
      const targetToday = new Date();
      targetToday.setHours(targetH, targetM, 0, 0);
      const targetTime = targetToday.getTime();

      if (now >= targetTime && lastSync < targetTime) {
        return true;
      }
    }
    if (elapsedMs >= 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
  }

  return false;
}

/**
 * Universal Heuristic Auto-Detection for spreadsheet columns
 */
export function autoDetectMapping(headers: string[]): { fileType: string; mapping: Record<string, string> } | null {
  const lower = headers.map(h => h.toLowerCase().trim());

  const hasOrder = lower.some(h => h.includes('order') || h.includes('invoice') || h.includes('bill') || h.includes('trans'));
  const hasCust = lower.some(h => h.includes('cust') || h.includes('client') || h.includes('buyer'));
  const hasQty = lower.some(h => h.includes('qty') || h.includes('quantity') || h.includes('units') || h.includes('count'));
  const hasPrice = lower.some(h => h.includes('price') || h.includes('amount') || h.includes('rate') || h.includes('total') || h.includes('revenue') || h.includes('mrp'));
  const hasProd = lower.some(h => h.includes('product') || h.includes('item') || h.includes('name') || h.includes('title') || h.includes('desc'));

  if ((hasOrder || hasCust) && (hasProd || hasQty || hasPrice)) {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const l = h.toLowerCase().trim();
      // Specific composite identifiers first
      if (l === 'reorder level' || l === 'min stock' || l === 'reorder point' || l === 'minimum stock') mapping[h] = 'minStock';
      else if (l === 'safety stock') mapping[h] = 'safetyStock';
      else if (l.includes('lead time')) mapping[h] = 'leadTimeDays';
      else if (l.includes('order status') || l.includes('delivery status') || l.includes('fulfillment status') || l === 'status') mapping[h] = 'status';
      else if (l === 'order date' || l === 'invoice date' || l === 'transaction date' || l === 'sale date' || l === 'date' || l === 'created at') mapping[h] = 'orderDate';
      else if (l === 'invoice no' || l === 'invoice number' || l === 'invoice id' || l === 'inv no') mapping[h] = 'orderNumber';
      else if (l === 'order id' || l === 'order no' || l === 'order number' || l === 'transaction id' || l === 'bill no') mapping[h] = 'orderNumber';
      else if (l.includes('customer name') || l === 'customer' || l === 'buyer' || l === 'client') mapping[h] = 'customerName';
      else if (l.includes('customer id') || l.includes('buyer id') || l.includes('client id')) mapping[h] = 'customerId';
      else if (l.includes('supplier name') || l.includes('vendor name') || l === 'supplier' || l === 'vendor') mapping[h] = 'supplier';
      else if (l.includes('supplier id') || l.includes('vendor id')) mapping[h] = 'supplierId';
      else if (l === 'item name' || l === 'product name' || l === 'product title' || l === 'item title' || l === 'product' || l === 'item') mapping[h] = 'productName';
      else if (l === 'sku' || l === 'product code' || l === 'item code' || l === 'barcode') mapping[h] = 'sku';
      else if (l === 'category' || l === 'department' || l === 'collection') mapping[h] = 'category';
      else if (l === 'qty sold' || l === 'quantity sold' || l === 'units sold' || l === 'sold qty' || l === 'qty' || l === 'quantity' || l === 'units') mapping[h] = 'quantity';
      else if (l === 'purchase price' || l === 'cost price' || l === 'cost per unit' || l === 'unit cost' || l === 'cogs per unit' || l === 'cogs' || l === 'cost') mapping[h] = 'costPrice';
      else if (l === 'retail price' || l === 'selling price' || l === 'unit price' || l === 'mrp' || l === 'sale price' || l === 'price' || l === 'amount') mapping[h] = 'sellingPrice';
      else if (l === 'current stock' || l === 'stock on hand' || l === 'available stock' || l === 'inventory qty' || l === 'stock qty' || l === 'stock') mapping[h] = 'stock';
      else if (l.includes('payment mode') || l.includes('payment method') || l.includes('payment type') || l === 'payment') mapping[h] = 'paymentMode';
      else if (l === 'city' || l === 'customer city' || l === 'location' || l === 'town') mapping[h] = 'city';
      else if (l === 'warehouse' || l === 'fulfillment center') mapping[h] = 'warehouse';
      else if (l === 'revenue' || l === 'total revenue' || l === 'total sales' || l === 'total amount') mapping[h] = 'revenue';
      else if (l === 'discount') mapping[h] = 'discount';
      else if (l === 'tax' || l === 'gst' || l === 'vat') mapping[h] = 'tax';
      else mapping[h] = 'skip';
    });
    return { fileType: 'SALES_REPORT', mapping };
  }

  if (hasProd && (hasPrice || hasQty || lower.some(h => h.includes('stock')))) {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const l = h.toLowerCase().trim();
      if (l === 'reorder level' || l === 'min stock' || l === 'reorder point') mapping[h] = 'minStock';
      else if (l === 'safety stock') mapping[h] = 'safetyStock';
      else if (l.includes('lead time')) mapping[h] = 'leadTimeDays';
      else if (l.includes('supplier name') || l.includes('vendor name') || l === 'supplier' || l === 'vendor') mapping[h] = 'supplier';
      else if (l.includes('supplier id') || l.includes('vendor id')) mapping[h] = 'supplierId';
      else if (l === 'item name' || l === 'product name' || l === 'product' || l === 'item' || l === 'name' || l === 'title') mapping[h] = 'name';
      else if (l === 'purchase price' || l === 'cost price' || l === 'cost per unit' || l === 'unit cost' || l === 'cost') mapping[h] = 'costPrice';
      else if (l === 'retail price' || l === 'selling price' || l === 'price' || l === 'rate' || l === 'mrp') mapping[h] = 'price';
      else if (l === 'current stock' || l === 'stock on hand' || l === 'stock' || l === 'qty' || l === 'quantity' || l === 'units' || l === 'avail') mapping[h] = 'stock';
      else if (l === 'sku' || l === 'product code' || l === 'item code' || l === 'barcode') mapping[h] = 'sku';
      else if (l === 'category' || l === 'department') mapping[h] = 'category';
      else if (l === 'unit' || l === 'uom') mapping[h] = 'unit';
      else if (l === 'description' || l === 'desc') mapping[h] = 'description';
      else mapping[h] = 'skip';
    });
    return { fileType: 'INVENTORY_MASTER', mapping };
  }

  return null;
}
