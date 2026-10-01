import { Link } from 'react-router-dom';
import { sampleTransactions, useDemo } from '../data/DemoContext';
import PageHeading from '../components/PageHeading';
import TransactionTable from '../components/TransactionTable';
import StatusBadge from '../components/StatusBadge';
import { pesos } from '../lib/format';

// Summarize the shared sample data and link to the main admin tasks.
export default function Dashboard() {
  const { students, product } = useDemo();
  return <>
    <PageHeading title="Dashboard" description="Manage your single machine from one place." />
    <div className="grid">
      <section className="card"><h3>Available stock</h3><strong>{product.stock}</strong><p>{product.name} · {pesos(product.price)}</p><Link to="/product">Manage product →</Link></section>
      <section className="card"><h3>Registered students</h3><strong>{students.length}</strong><p>{students.filter((student) => student.active).length} active cards</p><Link to="/students">Manage students →</Link></section>
      <section className="card"><h3>Machine</h3><StatusBadge>Not connected</StatusBadge><p>ESP32-S3 will be connected after the software is ready.</p></section>
    </div>
    <section className="card"><h3>Recent activity</h3><TransactionTable rows={sampleTransactions} /></section>
  </>;
}
