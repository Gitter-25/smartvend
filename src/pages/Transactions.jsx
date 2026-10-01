import { useState } from 'react';
import { sampleTransactions } from '../data/DemoContext';
import PageHeading from '../components/PageHeading';
import TransactionTable from '../components/TransactionTable';
import { pesos } from '../lib/format';

// Filter sample transactions and show the selected transaction details.
export default function Transactions() {
  const [type, setType] = useState('All');
  const [selected, setSelected] = useState(null);
  const rows = sampleTransactions.filter((row) => type === 'All' || row.type === type);
  return <><PageHeading title="Transactions" description="Review top-ups, purchases, and dispensing results." />
    <section className="card"><label htmlFor="type">Transaction type<select id="type" value={type} onChange={(event) => setType(event.target.value)}><option>All</option><option>Top-up</option><option>Purchase</option></select></label>
      <TransactionTable rows={rows} onSelect={setSelected} />
    </section>
    {selected && <section className="card" aria-live="polite"><h3>{selected.id}</h3><p>{selected.student} · {selected.type} · {pesos(selected.amount)}</p><p>{new Date(selected.date).toLocaleString('en-PH')} · {selected.status}</p><p>{selected.note}</p></section>}
  </>;
}
