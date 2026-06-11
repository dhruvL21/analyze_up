
'use client';

import {
  collection,
  onSnapshot,
  query,
  where,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type UseCollectionState<T> = {
  data: T[] | null;
  loading: boolean;
};

export function useCollection<T>(ref: Query | CollectionReference | null) {
  const [state, setState] = useState<UseCollectionState<T>>({
    data: null,
    loading: true,
  });

  useEffect(() => {
    if (!ref) {
        setState({ data: [], loading: false });
        return;
    };
    
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setState({ data, loading: false });
      },
      (serverError) => {
        console.error('Error listening to collection:', serverError);
        const permissionError = new FirestorePermissionError({
            path: ref.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setState({ data: null, loading: false });
      }
    );
    return () => unsubscribe();
  }, [ref?.path]);

  return state;
}
