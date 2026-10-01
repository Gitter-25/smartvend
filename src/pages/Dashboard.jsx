import StatusBadge from '../components/StatusBadge';

// Show the project status before live data is connected.
export default function Dashboard() {
  return <>
    <p className="eyebrow">OVERVIEW</p><h2>Dashboard</h2><p>Your SmartVend software starts here.</p>
    <div className="grid">
      <section className="card"><h3>Machine</h3><StatusBadge>Not connected</StatusBadge><p>ESP32-S3 integration is planned for Phase 7.</p></section>
      <section className="card"><h3>Product stock</h3><strong>—</strong><p>Connect product data in Phase 3.</p></section>
      <section className="card"><h3>Payments</h3><StatusBadge>Not connected</StatusBadge><p>Maya sandbox integration is planned for Phase 5.</p></section>
    </div>
    <section className="card"><h3>Recent transactions</h3><p>No transactions yet. This is the Phase 1 setup preview.</p></section>
  </>;
}
