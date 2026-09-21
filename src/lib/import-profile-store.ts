import { BusinessFileType, FieldMapping } from '@/ai/flows/import-mapper-constants';
import { doc, setDoc, getDocs, collection, Firestore } from 'firebase/firestore';
import { serializePlainData } from './utils';

export interface ImportProfile {
  id: string;
  profileName: string;
  fileType: BusinessFileType;
  headersSignature: string;
  headers: string[];
  mapping: FieldMapping;
  createdAt: string;
  useCount: number;
}

let currentImportUserId: string | null = null;
let memoryProfiles: ImportProfile[] = [];

export function setActiveImportUserId(userId: string | null) {
  currentImportUserId = userId;
  memoryProfiles = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('analyzeup_import_profiles_v1');
      localStorage.removeItem('analyzeup_import_profiles');
    } catch {}
  }
}

export function getImportProfiles(userId?: string): ImportProfile[] {
  const uid = userId || currentImportUserId;
  if (!uid) return [];
  if (memoryProfiles.length > 0) return memoryProfiles;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`analyzeup_import_profiles_${uid}`);
    memoryProfiles = raw ? JSON.parse(raw) : [];
    return memoryProfiles;
  } catch (e) {
    console.error('Error reading import profiles:', e);
    return [];
  }
}

export async function fetchImportProfilesFromDb(firestore: Firestore, userId: string): Promise<ImportProfile[]> {
  try {
    const colRef = collection(firestore, 'users', userId, 'import_profiles');
    const snap = await getDocs(colRef);
    const profiles: ImportProfile[] = [];
    snap.forEach(docSnap => {
      const d = docSnap.data() as ImportProfile;
      if (d && d.headersSignature) profiles.push(d);
    });
    if (profiles.length > 0) {
      memoryProfiles = profiles;
    }
    return profiles;
  } catch (err) {
    console.warn('Failed to fetch import profiles from Firestore:', err);
    return getImportProfiles();
  }
}

export function saveImportProfile(
  fileType: BusinessFileType,
  headers: string[],
  mapping: FieldMapping,
  customName?: string,
  firestore?: Firestore,
  userId?: string
): ImportProfile {
  const profiles = getImportProfiles();
  const headersSignature = headers.slice().sort().join('|').toLowerCase();

  const profileName = customName || `Saved ${fileType.replace('_', ' ')} Format (${headers.length} Cols)`;

  const newProfile: ImportProfile = {
    id: `profile-${Date.now()}`,
    profileName,
    fileType,
    headersSignature,
    headers,
    mapping,
    createdAt: new Date().toISOString(),
    useCount: 1,
  };

  // Filter out any older duplicate signature profile
  const updated = [newProfile, ...profiles.filter(p => p.headersSignature !== headersSignature)];
  memoryProfiles = updated;

  // Persist directly to Cloud Firestore whenever database context is provided
  if (firestore && userId) {
    const docRef = doc(firestore, 'users', userId, 'import_profiles', newProfile.id);
    setDoc(docRef, serializePlainData(newProfile), { merge: true }).catch(err => {
      console.warn('Failed to write import profile directly to Firestore:', err);
    });
  }

  const uid = userId || currentImportUserId;
  if (typeof window !== 'undefined' && uid) {
    try {
      localStorage.setItem(`analyzeup_import_profiles_${uid}`, JSON.stringify(updated));
    } catch {
      // Ignored if local storage unavailable
    }
  }
  return newProfile;
}

export function findMatchingImportProfile(headers: string[], customList?: ImportProfile[], userId?: string): ImportProfile | null {
  const profiles = customList && customList.length > 0 ? customList : getImportProfiles(userId);
  if (profiles.length === 0) return null;

  const currentSignature = headers.slice().sort().join('|').toLowerCase();
  
  // 1. Check exact signature match
  const exact = profiles.find(p => p.headersSignature === currentSignature);
  if (exact) {
    return exact;
  }

  // 2. Check subset/high overlap match (>85% matching headers)
  const currentSet = new Set(headers.map(h => h.toLowerCase()));
  for (const p of profiles) {
    const matchCount = p.headers.filter(h => currentSet.has(h.toLowerCase())).length;
    const ratio = matchCount / Math.max(headers.length, p.headers.length);
    if (ratio >= 0.85) {
      return p;
    }
  }

  return null;
}

export function clearAllImportProfiles(userId?: string): void {
  const uid = userId || currentImportUserId;
  memoryProfiles = [];
  if (typeof window !== 'undefined') {
    try {
      if (uid) {
        localStorage.removeItem(`analyzeup_import_profiles_${uid}`);
      }
      localStorage.removeItem('analyzeup_import_profiles_v1');
      localStorage.removeItem('analyzeup_import_profiles');
    } catch (e) {
      console.error('Error clearing import profiles:', e);
    }
  }
}
