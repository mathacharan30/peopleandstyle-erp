import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Holds only the bill data a customer's public link needs to rebuild the PDF.
// Firestore rules must allow `get` (not `list`) on this collection without login.
const COLLECTION = 'publicInvoices';

export const savePublicInvoice = (publicId, invoice) =>
  setDoc(doc(db, COLLECTION, publicId), { invoice, updatedAt: serverTimestamp() });

export const deletePublicInvoice = (publicId) => deleteDoc(doc(db, COLLECTION, publicId));

export async function getPublicInvoice(publicId) {
  const snap = await getDoc(doc(db, COLLECTION, publicId));
  return snap.exists() ? snap.data().invoice : null;
}
