import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, secondaryAuth } from './config';

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logout = () => signOut(auth);

export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, callback);

// Create an employee Firebase account without signing out the current admin
export const createEmployeeAccount = async (email, password) => {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await signOut(secondaryAuth);
  return credential.user.uid;
};
