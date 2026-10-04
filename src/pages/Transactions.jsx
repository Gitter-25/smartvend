import { useEffect, useState } from 'react';
import { useData } from '../data/AppData';
import { supabase, demoMode } from '../lib/supabase';
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
          let query = supabase.from('transactions').select('id,type,amount,status,created_at,note,slot_id,product_name,payment_method,students(name)').order('created_at', { ascending: false }).order('id', { ascending: false });
          if (filters.type !== 'All') query = query.eq('type', filters.type);
          if (filters.student) query = query.eq('student_id', filters.student);
          if (filters.slot) query = query.eq('slot_id', Number(filters.slot));
          if (filters.date) {
            const start = new Date(`${filters.date}T00:00:00`);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
          }
          const result = await query.range(page * size, (page + 1) * size);
          if (result.error) throw result.error;
          data = result.data.map((row) => ({ ...row, date: row.created_at, student: row.students?.name ?? (row.payment_method === 'QR test' ? 'QR customer (test)' : 'Unknown'), note: row.slot_id ? `Slot ${row.slot_id} · ${row.product_name} · ${row.note}` : row.note }));
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
    <section className="card"><label>Type<select value={filters.type} onChange={(event) => change('type', event.target.value)}><option>All</option><option>Top-up</option><option>Purchase</option></select></label>
      <label>Student<select disabled={demoMode} value={filters.student} onChange={(event) => change('student', event.target.value)}><option value="">All students</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.number}</option>)}</select></label>
      <label>Slot<select disabled={demoMode} value={filters.slot} onChange={(event) => change('slot', event.target.value)}><option value="">Both slots and top-ups</option><option value="1">Slot 1</option><option value="2">Slot 2</option></select></label>
      <label>Date<input disabled={demoMode} type="date" value={filters.date} onChange={(event) => change('date', event.target.value)} /></label>
      <Button disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh</Button><p role="status">{busy ? 'Loading…' : error}</p>
      {!busy && <TransactionTable rows={rows} onSelect={setSelected} />}
      <Button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Previous</Button> <span>Page {page + 1}</span> <Button disabled={busy || !more} onClick={() => setPage(page + 1)}>Next</Button>
    </section>
    {selected && <section className="card"><h3>{selected.id}</h3><p>{selected.student} · {selected.type} · {pesos(selected.amount)}</p><p>{new Date(selected.date).toLocaleString()} · {selected.status === 'Reversed' ? 'Refunded' : selected.status}</p><p>{selected.note}</p></section>}
  </>;
}
