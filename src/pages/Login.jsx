import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../data/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';

// Sign in an existing admin using Supabase email and password authentication.
export default function Login() {
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Submit credentials and show a clear error when sign-in fails.
  async function signIn(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: data.get('email').trim(), password: data.get('password') });
      if (error) setMessage(error.message);
    } catch { setMessage('Could not sign in. Check your connection.'); }
    finally { setBusy(false); }
  }
  if (auth.session && auth.admin) return <Navigate to="/dashboard" replace />;
  return <div className="login"><section className="card">
    <p className="eyebrow">SMARTVEND</p><h2>Admin login</h2>
    {!supabase && <p>{auth.demoMode ? 'Sample-data preview. Login is disabled.' : 'Add your Supabase settings to .env.local and restart the app. See docs/SETUP.md.'}</p>}
    <form onSubmit={signIn}>
      <Input label="Email" id="email" name="email" type="email" autoComplete="username" required />
      <Input label="Password" id="password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={!supabase || busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form><p role="alert">{message || auth.error}</p>
    {auth.session && !auth.admin && <Button onClick={auth.signOut}>Sign out</Button>}
    {auth.demoMode && <Link to="/dashboard">Open demo preview</Link>}
  </section></div>;
}
