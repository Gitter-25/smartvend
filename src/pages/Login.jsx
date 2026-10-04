import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';

// Sign in an existing admin using the local Express server.
export default function Login() {
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Submit credentials and show a clear error when sign-in fails.
  async function signIn(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      await auth.signIn({ email: data.get('email').trim(), password: data.get('password') });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  if (auth.session && auth.admin) return <Navigate to="/dashboard" replace />;
  return <div className="login"><section className="card">
    <p className="eyebrow">SMARTVEND</p><h2>Admin login</h2>
    <p>{auth.demoMode ? 'Sample-data preview. Login is disabled.' : 'Use the administrator created with npm run setup.'}</p>
    <form onSubmit={signIn}>
      <Input label="Email" id="email" name="email" type="email" autoComplete="username" required />
      <Input label="Password" id="password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={auth.demoMode || busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form><p role="alert">{message || auth.error}</p>
    {auth.session && !auth.admin && <Button onClick={auth.signOut}>Sign out</Button>}
    {auth.demoMode && <Link to="/dashboard">Open demo preview</Link>}
  </section></div>;
}
