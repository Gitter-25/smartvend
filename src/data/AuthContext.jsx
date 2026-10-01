import { createContext, useContext, useEffect, useState } from 'react';
import { demoMode, supabase } from '../lib/supabase';
const AuthContext = createContext(null);

// Track the signed-in session and verify its admin membership.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState('');

  // Observe login, logout, and token changes without awaiting inside the callback.
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      changed = true;
      if (mounted) { setSession(next); setReady(true); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted && !changed) { setSession(data.session); setError(error?.message ?? ''); setReady(true); }
    }).catch(() => { if (mounted) { setError('Could not check your session. Reload to retry.'); setReady(true); } });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  // Check server-side admin membership whenever the session changes.
  useEffect(() => {
    setAdmin(false);
    if (!session) return;
    let mounted = true;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (mounted) { setAdmin(data === true); setError(error?.message ?? (data ? '' : 'This account is not a SmartVend admin.')); }
    }).catch(() => { if (mounted) setError('Could not verify admin access. Reload to retry.'); });
    return () => { mounted = false; };
  }, [session?.user.id]);

  // Sign out through Supabase and report failures to the interface.
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
  }
  return <AuthContext.Provider value={{ session, ready, admin, error, demoMode, signOut }}>{children}</AuthContext.Provider>;
}

// Read authentication state from a component.
export function useAuth() { return useContext(AuthContext); }
