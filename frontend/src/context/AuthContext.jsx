import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

// Ruoli autorizzati alle funzioni del personale del rifugio.
const STAFF_ROLES = ['employee', 'warden'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al caricamento ripristina la sessione esistente (cookie) tramite /api/auth/me.
  useEffect(() => {
    authApi.getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const loggedUser = await authApi.login(credentials);
    setUser(loggedUser);
    return loggedUser;
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  const isStaff = STAFF_ROLES.includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, isStaff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
