
'use client';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  type Auth,
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

export const signIn = async (auth: Auth, email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signOut = async (auth: Auth) => {
  return firebaseSignOut(auth);
};

export const resetPassword = async (auth: Auth, email: string) => {
  return sendPasswordResetEmail(auth, email);
};
