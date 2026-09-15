'use client';

import {
  onSnapshot,
  type DocumentReference,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

type UseDocState<T> = {
  data: T | null;
  loading: boolean;
};

export function useDoc<T>(ref: DocumentReference | null) {
  const [state, setState] = useState<UseDocState<T>>({
    data: null,
    loading: !!ref,
  });

  const path = ref ? ref.path : undefined;

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false });
      return;
    }
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const rawDocData = (snapshot.data() || {}) as Record<string, any>;
        const cleanDocId = snapshot.id || rawDocData.id || '';
        const data = snapshot.exists() ? ({ ...rawDocData, id: cleanDocId } as T) : null;
        setState({ data, loading: false });
      },
      (serverError) => {
        console.warn('Firestore doc listener notice:', serverError.message);
        setState({ data: null, loading: false });
      }
    );
    return () => unsubscribe();
  }, [path]);

  return state;
}
