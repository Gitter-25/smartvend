import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import Button from './Button';
const pages = ['Dashboard', 'Students', 'Product', 'Purchase', 'Transactions', 'Machine'];

// Display the shared navigation and selected admin page.
export default function AppLayout() {
  const auth = useAuth();
  return (
    <div className="layout">
      <aside>
        <h1>SmartVend<span>ADMIN CONSOLE</span></h1>
        <nav>{pages.map((page) => <NavLink key={page} to={`/${page.toLowerCase()}`}>{page}</NavLink>)}</nav>
        <NavLink to="/login">{auth.demoMode ? 'Login preview' : 'Account'}</NavLink>
        {!auth.demoMode && <Button onClick={auth.signOut}>Sign out</Button>}
      </aside>
      <main><header>Single machine · Two slots <span className="badge">{auth.demoMode ? 'Demo preview' : 'Supabase connected'}</span></header><div className="notice">{auth.demoMode ? 'Sample data only · Changes reset on refresh · Use test card identifiers' : 'Admin access · Card enrollment uses backend encryption'}</div><Outlet /></main>
    </div>
  );
}
