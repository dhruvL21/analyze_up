/**
 * Privileged Firebase Admin SDK Initialization
 * Used exclusively on the server (Next.js Node.js runtime) for trusted persistence.
 * Bypasses client Firestore Security Rules while enforcing server-side tenant isolation.
 * 
 * IMPORTANT:
 * - Uses modular subpath imports (firebase-admin/app, firebase-admin/firestore, firebase-admin/auth)
 *   to avoid CJS/ESM undefined "INTERNAL" runtime errors under Next.js Turbopack.
 * - Never logs or exposes private keys or credentials.
 * - Dynamic environment resolution: NEVER hardcodes or defaults project ID to a static fallback.
 */

import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';

let adminApp: App | null = null;
let adminFirestore: Firestore | null = null;
let adminAuth: Auth | null = null;

export class PersistenceError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(code: string, message: string, details?: any) {
    super(`[PersistenceError ${code}]: ${message}`);
    this.name = 'PersistenceError';
    this.code = code;
    this.details = details;

    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, PersistenceError);
    }
  }
}

/**
 * Returns the dynamically configured Firebase Project ID from the environment.
 * Throws a PersistenceError if not configured to prevent accidental writes to unintended projects.
 */
export function getFirebaseAdminProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !projectId.trim()) {
    throw new PersistenceError(
      'FIREBASE_PROJECT_ID_MISSING',
      'FIREBASE_PROJECT_ID environment variable is not configured. Please specify FIREBASE_PROJECT_ID in .env'
    );
  }
  return projectId.trim();
}

/**
 * Checks if privileged server-side Admin SDK credentials (service account) are configured.
 */
export function hasAdminCredentials(): boolean {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  return Boolean((clientEmail && rawPrivateKey) || saKey);
}

/**
 * Returns the initialized Firebase Admin App singleton.
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = getFirebaseAdminProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  // 1. Initialize with explicit Service Account credentials if provided
  if (clientEmail && rawPrivateKey) {
    try {
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      console.log(`[Firestore] Initialized Firebase Admin SDK with service account for project: ${projectId}`);
      return adminApp;
    } catch (err: any) {
      console.error('[Firestore] Service account credential initialization failed:', err?.message || err);
      throw new PersistenceError(
        'FIREBASE_ADMIN_AUTH_FAILED',
        `Failed to initialize Firebase Admin SDK with service account: ${err?.message || err}`
      );
    }
  }

  // 2. Check for service account JSON in FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountEnv) {
    try {
      let serviceAccount: any = null;
      if (serviceAccountEnv.trim().startsWith('{')) {
        serviceAccount = JSON.parse(serviceAccountEnv);
      } else if (fs.existsSync(serviceAccountEnv)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountEnv, 'utf8'));
      }
      if (serviceAccount) {
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId,
        });
        console.log(`[Firestore] Initialized Firebase Admin SDK with service account JSON for project: ${projectId}`);
        return adminApp;
      }
    } catch (saErr: any) {
      console.warn('[Firestore] Notice checking service account config:', saErr?.message || saErr);
    }
  }

  // 3. Fallback to Google Application Default Credentials (GCP/Cloud Run/Local ADC)
  try {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
    console.log(`[Firestore] Initialized Firebase Admin SDK with application default credentials for project: ${projectId}`);
    return adminApp;
  } catch (adcErr: any) {
    // 4. Fallback to project-scoped initialization (for local dev / emulated environments)
    try {
      adminApp = initializeApp({ projectId });
      console.log(`[Firestore] Initialized Firebase Admin SDK in project-scoped mode for project: ${projectId}`);
      return adminApp;
    } catch (fallbackErr: any) {
      console.error('[Firestore] Firebase Admin SDK initialization error:', fallbackErr?.message || fallbackErr);
      throw new PersistenceError(
        'FIREBASE_ADMIN_INIT_FAILED',
        `Unable to initialize Firebase Admin SDK. Please configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env: ${fallbackErr?.message || fallbackErr}`
      );
    }
  }
}

/**
 * Returns the privileged Firebase Admin Firestore instance.
 */
export function getAdminFirestore(): Firestore {
  if (adminFirestore) return adminFirestore;
  const app = getAdminApp();
  adminFirestore = getFirestore(app);
  try {
    adminFirestore.settings({ ignoreUndefinedProperties: true });
  } catch {}
  return adminFirestore;
}

/**
 * Returns the privileged Firebase Admin Auth instance.
 */
export function getAdminAuth(): Auth {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  adminAuth = getAuth(app);
  return adminAuth;
}
