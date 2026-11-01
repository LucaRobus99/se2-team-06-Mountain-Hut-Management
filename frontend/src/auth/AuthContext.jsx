import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout, registerHiker as apiRegister } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState('');

  // Verifica il cookie di sessione al primo caricamento o refresh della pagina.
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setAuthError('');
        }
      })
      .catch((err) => {
        if (active) {
          setUser(null);
          setAuthError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoadingAuth(false);
      });
    return () => { active = false; };
  }, []);

  async function signIn(credentials) {
    const authenticatedUser = await apiLogin(credentials);
    setUser(authenticatedUser);
    setAuthError('');
    return authenticatedUser;
  }

  async function signUp(registration) {
    const registeredUser = await apiRegister(registration);
    setUser(registeredUser);
    setAuthError('');
    return registeredUser;
  }

  async function signOut() {
    await apiLogout();
    setUser(null);
    setAuthError('');
  }

  // Serve per riallineare il frontend alla sessione dopo errori 401.
  async function refreshUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error.status === 401 || error.code === 'UNAUTHENTICATED') setUser(null);
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{
      user, loadingAuth, authError, signIn, signUp, signOut, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider.');
  return auth;
}
