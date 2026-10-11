import { useEffect, useState } from 'react';
import { useData } from '../data/AppData';
import { api, apiResult, demoMode } from '../lib/api';
import PageHeading from '../components/PageHeading';
import TransactionTable from '../components/TransactionTable';
import Button from '../components/Button';
import { pesos } from '../lib/format';
const size = 25;

// Fetch each page from the server, applying filters before pagination.
export default function Transactions() {
  const { transactions, students } = useData();
  const [filters, setFilters] = useState({ type: 'All', student: '', slot: '', date: '' });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Ignore stale responses when a filter changes while its previous request runs.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true); setError(''); setSelected(null);
      try {
        let data;
        if (demoMode) {
          data = transactions.filter((row) => filters.type === 'All' || row.type === filters.type).slice(page * size, (page + 1) * size + 1);
        } else {
          const params = new URLSearchParams({ limit: String(size + 1), offset: String(page * size) });
          if (filters.type !== 'All') params.set('type', filters.type);
          if (filters.student) params.set('student', filters.student);
          if (filters.slot) params.set('slot', filters.slot);
          if (filters.date) {
            const start = new Date(`${filters.date}T00:00:00`);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            params.set('start', start.toISOString()); params.set('end', end.toISOString());
          }
          const result = await apiResult(`/transactions?${params}`);
          if (result.error) throw result.error;
          data = result.data;
        }
        if (!cancelled) { setRows(data.slice(0, size)); setMore(data.length > size); }
      } catch (failure) { if (!cancelled) { setRows([]); setMore(false); setError(failure.message); } }
      finally { if (!cancelled) setBusy(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [page, filters, refresh, transactions]);

  // Reset the page whenever the selected filter changes.
  function change(name, value) { setFilters((previous) => ({ ...previous, [name]: value })); setPage(0); }
  return <><PageHeading title="Transactions" description="Review top-ups and purchases. Dates use your browser's local timezone." />
    <section className="card"><div className="filter-grid"><label>Type<select value={filters.type} onChange={(event) => change('type', event.target.value)}><option>All</option><option>Top-up</option><option>Purchase</option></select></label>
      <label>Student<select disabled={demoMode} value={filters.student} onChange={(event) => change('student', event.target.value)}><option value="">All students</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.number}</option>)}</select></label>
      <label>Slot<select disabled={demoMode} value={filters.slot} onChange={(event) => change('slot', event.target.value)}><option value="">Both slots and top-ups</option><option value="1">Slot 1</option><option value="2">Slot 2</option></select></label>
      <label>Date<input disabled={demoMode} type="date" value={filters.date} onChange={(event) => change('date', event.target.value)} /></label></div>
      <Button className="secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh transactions</Button><p role="status">{busy ? 'Loading…' : error}</p>
      {!busy && <TransactionTable rows={rows} onSelect={setSelected} />}
      <div className="pagination"><Button className="secondary" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1}</span><Button className="secondary" disabled={busy || !more} onClick={() => setPage(page + 1)}>Next</Button></div>
    </section>
    {selected && <section className="card receipt"><div className="section-heading"><h3>Transaction details</h3><Button className="secondary" onClick={() => setSelected(null)}>Close details</Button></div><p className="reference">{selected.id}</p><p>{selected.student} · {selected.type} · {pesos(selected.amount)}</p><p>{new Date(selected.date).toLocaleString()} · {selected.status === 'Reversed' ? 'Refunded' : selected.status === 'RefundPending' ? 'Refund pending' : selected.status}</p><p>{selected.note}</p></section>}
  </>;
}
