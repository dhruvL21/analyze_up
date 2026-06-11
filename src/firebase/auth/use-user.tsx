
'use client';

import { Auth, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAuth } from '../provider';
import type { User } from 'firebase/auth';

type UseUserState = {
  user: User | null;
  loading: boolean;
};

export const useUser = (): UseUserState => {
  const auth = useAuth() as Auth;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
};
