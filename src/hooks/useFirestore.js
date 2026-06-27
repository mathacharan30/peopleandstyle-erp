import { useState, useEffect } from 'react';
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
} from '../services/firebase/firestore';

export function useFirestore(collectionName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCollection(
      collectionName,
      (docs) => {
        setData(docs);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [collectionName]);

  const add = async (docData) => {
    try {
      return await addDocument(collectionName, docData);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const update = async (id, docData) => {
    try {
      await updateDocument(collectionName, id, docData);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const remove = async (id) => {
    try {
      await deleteDocument(collectionName, id);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  return { data, loading, error, add, update, remove };
}
