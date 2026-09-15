'use client';

import {
  onSnapshot,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { serializePlainData } from '@/lib/utils';

type UseCollectionState<T> = {
  data: T[] | null;
  loading: boolean;
};

export function useCollection<T>(ref: Query | CollectionReference | null) {
  const [state, setState] = useState<UseCollectionState<T>>({
    data: null,
    loading: !!ref,
  });

  const path = ref && 'path' in ref ? (ref as CollectionReference).path : undefined;
  const recordsRef = useRef<Map<string, T>>(new Map());

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false });
      return;
    }

    recordsRef.current = new Map();
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    let receivedInitialSnapshot = false;

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const changes = snapshot.docChanges();
        if (changes.length === 0 && receivedInitialSnapshot) {
          return;
        }

        changes.forEach((change) => {
          if (change.type === 'removed') {
            recordsRef.current.delete(change.doc.id);
            return;
          }
          const rawDocData = (change.doc.data() || {}) as Record<string, any>;
          const cleanDocId = change.doc.id || rawDocData.id || '';
          recordsRef.current.set(change.doc.id, serializePlainData<T>({
            ...rawDocData,
            id: cleanDocId,
          } as T));
        });

        receivedInitialSnapshot = true;
        setState({ data: Array.from(recordsRef.current.values()), loading: false });
      },
      (serverError) => {
        console.warn('Firestore collection listener notice:', serverError.message);
        setState({ data: null, loading: false });
      }
    );
    return () => unsubscribe();
  }, [path]);

  return state;
}
