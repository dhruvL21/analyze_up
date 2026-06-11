
'use client';

import {
  onSnapshot,
  type DocumentReference,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';


type UseDocState<T> = {
  data: T | null;
  loading: boolean;
};

export function useDoc<T>(ref: DocumentReference | null) {
  const [state, setState] = useState<UseDocState<T>>({
    data: null,
    loading: true,
  });

  useEffect(() => {
     if (!ref) {
      setState({ data: null, loading: false });
      return;
    }
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = { id: snapshot.id, ...snapshot.data() } as T;
        setState({ data, loading: false });
      },
      (serverError) => {
        console.error('Error listening to document:', serverError);
        const permissionError = new FirestorePermissionError({
            path: ref.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setState({ data: null, loading: false });
      }
    );
    return () => unsubscribe();
  }, [ref?.path]);

  return state;
}
