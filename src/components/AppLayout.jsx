import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../data/AuthContext';
import Button from './Button';
import Icon from './Icon';
import { useData } from '../data/AppData';
const pages = [
  ['dashboard', 'Overview', 'dashboard'], ['students', 'Students & wallets', 'students'],
  ['product', 'Product slots', 'product'], ['purchase', 'Card purchase test', 'card'],
  ['qr', 'QR payments', 'qr'], ['transactions', 'Transactions', 'transactions'], ['machine', 'Machine status', 'machine'],
];

// Display the shared navigation and selected admin page.
export default function AppLayout() {
  const auth = useAuth();
  const { products, loading, error, loadData } = useData();
  return (
    <div className="layout">
      <aside>
        <div className="brand"><span className="brand-icon"><Icon name="machine" size={25} /></span><h1>SmartVend<span>ADMIN CONSOLE</span></h1></div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">{pages.map(([path, label, icon]) => <NavLink key={path} to={`/${path}`}><Icon name={icon} />{label}</NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="sidebar-project"><Icon name="shield" /><div>Classroom project<small>One machine · Two slots</small></div></div>
          {auth.demoMode ? <NavLink to="/login">Login preview</NavLink> : <Button className="sign-out" onClick={auth.signOut}><Icon name="logout" size={18} />Sign out</Button>}
        </div>
      </aside>
      <main><header className="workspace-header"><span>SmartVend <span className="header-divider">/</span> Administration</span><span className="header-session"><Icon name="shield" size={16} />{auth.demoMode ? 'Sample-data preview' : 'Administrator session'}</span></header>
        <div className="notice"><Icon name="machine" size={18} /><span>{auth.demoMode ? 'Sample data only · Changes reset on refresh · Use fictional details' : 'Software demonstration · Card purchases are simulated · QR payments use PayMongo test mode'}</span></div>
        {(error || auth.error) && <div className="error-banner" role="alert"><span>{error ? `Workspace data could not load. Displayed values may be outdated. ${error}` : auth.error}</span>{error && <Button className="secondary" disabled={loading} onClick={loadData}>Retry loading data</Button>}</div>}
        {loading && <p className="loading-line" role="status">Refreshing workspace data…</p>}
        {loading && !products.length ? <section className="card"><h3>Loading workspace</h3><p>Preparing students, inventory, and transaction history…</p></section> : <Outlet />}<footer className="workspace-footer">SmartVend · Student card wallets & QR sandbox payments</footer>
      </main>
    </div>
  );
}
