import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthChange, logout } from '../services/firebase/auth';
import { db } from '../services/firebase/config';
import { loginUser as oneSignalLogin, logoutUser as oneSignalLogout } from '../services/onesignal';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      setLoading(true);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            const data = snap.data();
            // Sign out deactivated employees immediately
            if (data.role === 'employee' && data.employeeId) {
              const empSnap = await getDoc(doc(db, 'employees', data.employeeId));
              if (empSnap.exists() && empSnap.data().status === 'Inactive') {
                await logout();
                return;
              }
            }
            setRole(data.role || 'admin');
            setProfile(data);

            // Register employee with OneSignal for push notifications
            if (data.role === 'employee') {
              oneSignalLogin(u.uid);
            }
          } else {
            setRole('admin');
            setProfile(null);
          }
        } catch {
          setRole('admin');
          setProfile(null);
        }
      } else {
        setRole(null);
        setProfile(null);
        oneSignalLogout();
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, isAdmin, isEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
