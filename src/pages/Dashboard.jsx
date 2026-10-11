import { Link } from 'react-router-dom';
import { useData } from '../data/AppData';
import PageHeading from '../components/PageHeading';
import TransactionTable from '../components/TransactionTable';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';
import { pesos } from '../lib/format';

// Summarize actual workspace records without implying physical hardware is connected.
export default function Dashboard() {
  const { students, products, transactions } = useData();
  const activeCards = students.filter((student) => student.active && (student.cardId || student.card)).length;
  return <>
    <PageHeading title="Overview" description="Your vending workspace, at a glance." />
    <section className="overview-banner"><div><p className="eyebrow">SMARTER CAMPUS VENDING</p><h3>Two ways to pay.<br />One connected system.</h3><p>Manage student wallets, prepare product slots, and follow every test payment from checkout to settlement.</p><Link className="button-link" to="/qr">Open QR payments <Icon name="arrow" size={18} /></Link></div><div className="banner-visual" aria-hidden="true"><div className="vending-illustration"><div className="vending-display"><Icon name="product" size={38} /><Icon name="product" size={38} /></div><div className="vending-controls"><Icon name="card" /><Icon name="qr" /></div><div className="vending-tray" /></div><span className="banner-caption">SOFTWARE DEMONSTRATION</span></div></section>
    <div className="grid metrics">
      <section className="card metric-card"><span className="metric-icon"><Icon name="product" /></span><p className="metric-label">Available stock</p><strong className="metric-value">{products.reduce((total, product) => total + product.stock, 0)}</strong><p>Items across {products.length} product slots</p><Link to="/product">Manage inventory <Icon name="arrow" size={16} /></Link></section>
      <section className="card metric-card"><span className="metric-icon"><Icon name="students" /></span><p className="metric-label">Registered students</p><strong className="metric-value">{students.length}</strong><p>{activeCards} enrolled, active {activeCards === 1 ? 'card' : 'cards'}</p><Link to="/students">Manage students <Icon name="arrow" size={16} /></Link></section>
      <section className="card metric-card"><span className="metric-icon"><Icon name="machine" /></span><p className="metric-label">Hardware integration</p><strong className="metric-text">ESP32-S3</strong><p>Physical dispensing remains to be tested</p><Link to="/machine">Device contact & recovery <Icon name="arrow" size={16} /></Link></section>
    </div>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">INVENTORY</p><h3>Product slots</h3></div><Link to="/product">Edit slots <Icon name="arrow" size={16} /></Link></div>
      <div className="slot-summary-grid">{products.map((product) => <div className="slot-summary" key={product.id}><span className="slot-number">{String(product.id).padStart(2, '0')}</span><div><h4>{product.name}</h4><p>{pesos(product.price)} <span>·</span> {product.stock} available</p></div><StatusBadge>{product.stock > 0 ? 'In stock' : 'Out of stock'}</StatusBadge></div>)}</div>
      {!products.length && <p>Product slots will appear once workspace data is loaded.</p>}
    </section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">ACTIVITY</p><h3>Latest transactions</h3></div><Link to="/transactions">View all <Icon name="arrow" size={16} /></Link></div><TransactionTable rows={transactions.slice(0, 5)} /></section>
  </>;
}
