import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  type Auth,
  type User,
} from 'firebase/auth';

export const signUp = async (
  auth: Auth,
  email: string,
  password: string,
  displayName: string
) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });
  return userCredential;
};

export const clearClientSessionCaches = () => {
  if (typeof window === 'undefined') return;
  try {
    const unscopedKeys = [
      'analyzeup_applied_coupon',
      'analyzeup_coupon_discount',
      'analyzeup_subscription_plan',
      'analyzeup_data_readiness_snapshot',
      'analyzeup_ai_queries_count',
      'analyzeup_reports_count',
      'analyzeup_free_trial_session_prompted',
      'analyzeup_simulations',
      'analyzeup_saas_audit_logs',
      'analyzeup_saas_members',
      'analyzeup_import_profiles',
      'analyzeup_executive_snapshot',
      'analyzeup_custom_opportunities',
      'analyzeup_business_audit_logs',
      'analyzeup_completed_tasks',
      'analyzeup_event_statuses',
      'analyzeup_audit_logs',
    ];
    unscopedKeys.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (e) {}
};

export const signIn = async (auth: Auth, email: string, password: string) => {
  clearClientSessionCaches();
  return signInWithEmailAndPassword(auth, email, password);
};

export const signOut = async (auth: Auth) => {
  clearClientSessionCaches();
  return firebaseSignOut(auth);
};

export const resetPassword = async (auth: Auth, email: string) => {
  return sendPasswordResetEmail(auth, email);
};

export const updateUserPassword = async (user: User, newPassword: string) => {
  return updatePassword(user, newPassword);
};

