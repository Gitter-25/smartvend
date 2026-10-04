import { createContext, useContext, useEffect, useState } from 'react';
import { api, demoMode } from '../lib/api';
const AuthContext = createContext(null);

// Restore the server-side cookie session and keep authentication out of localStorage.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(demoMode);
  const [error, setError] = useState('');
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    api('/session').then((data) => { if (active) setSession(data.session); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  // Authenticate against the local administrator's salted password hash.
  async function signIn(credentials) {
    const data = await api('/login', credentials);
    setSession({ user: data.user }); setError(''); setReady(true);
  }
  // Revoke the saved server session before clearing the client state.
  async function signOut() {
    try { await api('/logout', {}); setSession(null); setError(''); }
    catch (failure) { setError(failure.message); }
  }
  return <AuthContext.Provider value={{ session, ready, admin: !!session, error, demoMode, signIn, signOut }}>{children}</AuthContext.Provider>;
}
// Read authentication state from a component.
export function useAuth() { return useContext(AuthContext); }
