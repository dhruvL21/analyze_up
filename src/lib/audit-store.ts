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

const AUDIT_STORAGE_KEY = 'analyzeup_business_audit_logs';
let memoryAuditLogs: BusinessAuditLog[] = [];

export function getAuditLogs(): BusinessAuditLog[] {
  if (memoryAuditLogs.length > 0) return memoryAuditLogs;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
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

  const logs = getAuditLogs();
  const updated = [newLog, ...logs].slice(0, 100);
  memoryAuditLogs = updated;

  // Persist directly into Firestore database whenever client is connected
  if (firestore && userId) {
    const docRef = doc(firestore, 'users', userId, 'audit_logs', newLog.id);
    setDoc(docRef, serializePlainData(newLog), { merge: true }).catch(err => {
      console.warn('Failed to write audit log directly to Firestore:', err);
    });
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignored
    }
    window.dispatchEvent(new CustomEvent('analyzeup_audit_logged', { detail: newLog }));
  }

  return newLog;
}

export function clearAuditLogs(): void {
  memoryAuditLogs = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
    } catch {
      // Ignored
    }
    window.dispatchEvent(new CustomEvent('analyzeup_audit_logged'));
  }
}
