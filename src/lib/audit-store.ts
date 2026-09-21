import { doc, setDoc, Firestore } from 'firebase/firestore';
import { serializePlainData } from './utils';

export interface BusinessAuditLog {
  id: string;
  title: string;
  productName: string;
  actionType: 'discount' | 'price_up' | 'reorder' | 'import' | 'sale' | 'supplier' | 'audit';
  changeDetails: string;
  previousValue?: string;
  newValue?: string;
  impactValue?: string;
  timestamp: string;
  performedBy: string;
}


let currentActiveUserId: string | null = null;
let memoryAuditLogs: BusinessAuditLog[] = [];

export function setActiveAuditUserId(userId: string | null): void {
  currentActiveUserId = userId;
  memoryAuditLogs = [];
  if (typeof window !== 'undefined') {
    try {
      // Always remove legacy unscoped key so it never lingers
      localStorage.removeItem('analyzeup_business_audit_logs');
    } catch {}
  }
}

export function getAuditLogs(userId?: string): BusinessAuditLog[] {
  const uid = userId || currentActiveUserId;
  // If no user is authenticated or active, strictly return empty array (prevent cross-account leaks)
  if (!uid) return [];

  if (memoryAuditLogs.length > 0) return memoryAuditLogs;
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(`analyzeup_business_audit_logs_${uid}`);
    memoryAuditLogs = raw ? JSON.parse(raw) : [];
    return memoryAuditLogs;
  } catch (err) {
    console.error('Error reading audit logs:', err);
    return [];
  }
}

export function logBusinessAction(
  entry: Omit<BusinessAuditLog, 'id' | 'timestamp' | 'performedBy'>,
  firestore?: Firestore,
  userId?: string
): BusinessAuditLog {
  const uid = userId || currentActiveUserId;
  const newLog: BusinessAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    performedBy: 'Business Founder',
    ...entry,
  };

  const logs = getAuditLogs(uid || undefined);
  const updated = [newLog, ...logs].slice(0, 100);
  memoryAuditLogs = updated;

  // Persist directly into Firestore database whenever client is connected
  if (firestore && uid) {
    const docRef = doc(firestore, 'users', uid, 'audit_logs', newLog.id);
    setDoc(docRef, serializePlainData(newLog), { merge: true }).catch(err => {
      console.warn('Failed to write audit log directly to Firestore:', err);
    });
  }

  if (typeof window !== 'undefined') {
    if (uid) {
      try {
        localStorage.setItem(`analyzeup_business_audit_logs_${uid}`, JSON.stringify(updated));
      } catch {
        // Ignored
      }
    }
    window.dispatchEvent(new CustomEvent('analyzeup_audit_logged', { detail: { newLog, userId: uid } }));
  }

  return newLog;
}

export function clearAuditLogs(userId?: string): void {
  const uid = userId || currentActiveUserId;
  memoryAuditLogs = [];
  if (typeof window !== 'undefined') {
    try {
      if (uid) {
        localStorage.removeItem(`analyzeup_business_audit_logs_${uid}`);
      }
      localStorage.removeItem('analyzeup_business_audit_logs');
    } catch {
      // Ignored
    }
    window.dispatchEvent(new CustomEvent('analyzeup_audit_logged', { detail: { userId: uid } }));
  }
}

