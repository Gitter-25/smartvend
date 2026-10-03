import { Navigate } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import { useData } from '../data/AppData';
import Button from './Button';

// Restrict admin pages and handle loading or failed database setup.
export default function ProtectedRoute({ children }) {
  const auth = useAuth();
  const data = useData();
  if (auth.demoMode) return children;
  if (!auth.ready) return <p>Checking session…</p>;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (!auth.admin) return <section className="card"><p role="alert">{auth.error || 'Checking admin access…'}</p><Button onClick={auth.signOut}>Sign out</Button></section>;
  if (data.loading && !data.products.length) return <p>Loading admin data…</p>;
  if (data.error) return <section className="card"><p role="alert">{data.error}</p><Button onClick={data.loadData}>Retry</Button></section>;
  if (!data.products.length) return <p>Loading slots…</p>;
  return children;
}
