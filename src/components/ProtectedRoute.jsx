import { Navigate } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import Button from './Button';

// Restrict admin pages and handle loading or failed database setup.
export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  if (auth.demoMode) return children;
  if (!auth.ready) return <div className="startup-state" role="status"><section className="card"><p className="eyebrow">SMARTVEND</p><h2>Opening your workspace</h2><p>Checking administrator session…</p></section></div>;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (!auth.admin) return <section className="card"><p role="alert">{auth.error || 'Checking admin access…'}</p><Button onClick={auth.signOut}>Sign out</Button></section>;
  // Keep navigation visible when a data refresh fails. The layout shows the error and retry.
  return children;
}
