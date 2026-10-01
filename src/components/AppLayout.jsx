import { NavLink, Outlet } from 'react-router-dom';
const pages = ['Dashboard', 'Students', 'Product', 'Transactions'];

// Display the shared navigation and selected admin page.
export default function AppLayout() {
  return (
    <div className="layout">
      <aside>
        <h1>SmartVend<span>ADMIN CONSOLE</span></h1>
        <nav>{pages.map((page) => <NavLink key={page} to={`/${page.toLowerCase()}`}>{page}</NavLink>)}</nav>
        <NavLink to="/login">Login preview</NavLink>
      </aside>
      <main><header>Single machine · Single product <span className="badge">Phase 1 · Setup</span></header><Outlet /></main>
    </div>
  );
}
