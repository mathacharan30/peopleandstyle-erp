import { initializeApp, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBIUSgjXdq14F6XyciW0_GqAjFSVNquQRQ",
  authDomain: "peopleandstyle-erp.firebaseapp.com",
  projectId: "peopleandstyle-erp",
  storageBucket: "peopleandstyle-erp.firebasestorage.app",
  messagingSenderId: "324963873691",
  appId: "1:324963873691:web:3da8ad9f8ca69a089fe73e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app — used to create employee accounts without signing out the admin
let secondaryApp;
try {
  secondaryApp = getApp('Secondary');
} catch {
  secondaryApp = initializeApp(firebaseConfig, 'Secondary');
}
export const secondaryAuth = getAuth(secondaryApp);

export default app;
