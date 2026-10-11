import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Icon from '../components/Icon';

// Sign in an existing administrator using the local Express server.
export default function Login() {
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function signIn(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const data = new FormData(event.currentTarget);
    try { await auth.signIn({ email: data.get('email').trim(), password: data.get('password') }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  if (auth.session && auth.admin) return <Navigate to="/dashboard" replace />;
  return <div className="login"><div className="login-shell">
    <section className="login-story"><div className="brand"><span className="brand-icon"><Icon name="machine" size={25} /></span><h1>SmartVend<span>CAMPUS VENDING SYSTEM</span></h1></div><div><p className="eyebrow">SIMPLE. CONNECTED. ACCOUNTABLE.</p><h2>A smarter way<br />to serve students.</h2><p>Student card wallets and QR test payments, managed in one workspace.</p><div className="login-features"><span><Icon name="card" />Encrypted card enrollment</span><span><Icon name="qr" />PayMongo sandbox checkout</span><span><Icon name="transactions" />Traceable stock & transactions</span></div></div><small>Classroom project · One machine · Two slots</small></section>
    <section className="login-form"><p className="eyebrow">ADMIN WORKSPACE</p><h2>Welcome back</h2><p>{auth.demoMode ? 'Explore a sample workspace. Sign-in is disabled in this preview.' : 'Sign in to manage students, products, and payments.'}</p>
      <form onSubmit={signIn}>
        <Input label="Email address" id="email" name="email" type="email" autoComplete="username" required placeholder="admin@example.com" />
        <Input label="Password" id="password" name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" />
        <Button type="submit" disabled={auth.demoMode || busy}>{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={18} /></Button>
      </form>{(message || auth.error) && <p className="form-message" role="alert">{message || auth.error}</p>}
      {auth.session && !auth.admin && <Button onClick={auth.signOut}>Sign out</Button>}
      {auth.demoMode && <Link to="/dashboard">Open sample-data preview →</Link>}
      <p className="login-note"><Icon name="shield" size={17} />Administrator access only</p>
    </section>
  </div></div>;
}
