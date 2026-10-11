import { useEffect, useState } from 'react';
import { api, apiResult, demoMode } from '../lib/api';
import { useData } from '../data/AppData';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Icon from '../components/Icon';
import StatusBadge from '../components/StatusBadge';

// Show machine contact and allow explicit reconciliation of uncertain dispensing.
export default function Machine() {
  const [seen, setSeen] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { loadData } = useData();

  // Read unresolved jobs; no timeout automatically refunds or repeats a dispense.
  async function refresh() {
    if (demoMode) return;
    setRefreshing(true);
    try {
      const data = await api('/machine');
      setSeen(data.last_seen); setJobs(data.jobs); setError('');
    } catch (failure) { setError(failure.message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { refresh(); }, []);

  // Record the checked physical outcome and let the backend settle it once.
  async function resolve(event, job) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { error } = await apiResult('/resolve', { request_id: job.id, dispensed: form.get('outcome') === 'yes', reason: form.get('reason').trim() });
      if (error) throw error;
      await refresh(); await loadData();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <><PageHeading title="Machine status" description="Device contact and recovery for a two-slot ESP32-S3 machine." />
    <section className="card"><div className="machine-summary"><span className="metric-icon"><Icon name="machine" size={28} /></span><div><h3>Last device contact</h3><p>{seen ? new Date(seen).toLocaleString() : 'No device contact recorded'}</p></div>
      <Button className="secondary" onClick={refresh} disabled={busy || refreshing || demoMode}>{refreshing ? 'Refreshing…' : 'Refresh status'}</Button></div><p className="scope-note">A contact timestamp can come from a software test request. It does not confirm that an ESP32, motor, or sensor is connected. Physical hardware testing is still pending.</p><p role="status">{error}</p></section>
    <section className="card"><h3>Unresolved dispensing</h3><p>Stop the device and inspect the output before resolving. An unknown result must remain pending. Resume the device only after it clears the resolved job.</p>
      {!jobs.length && !error && !refreshing && <div className="empty-state"><Icon name="check" size={28} /><h4>No unresolved jobs{demoMode ? ' in this preview' : ''}</h4><p>Orders awaiting payment, a dispense outcome, or a refund will appear here.</p></div>}
      {jobs.map((job) => <form className="job-form" key={job.id} onSubmit={(event) => resolve(event, job)}><div className="section-heading"><h4>{job.transactions?.product_name} · Slot {job.transactions?.slot_id}</h4><StatusBadge>{job.state}</StatusBadge></div><p className="reference">{job.id}</p><p>{job.transactions?.payment_method}</p>{['AwaitingPayment', 'RefundPending'].includes(job.state) ? <p>Continue payment or refund recovery on the <a href="/qr">QR page</a>.</p> : <>
        <label>Confirmed outcome<select name="outcome" required disabled={busy}><option value="">Select after inspection</option>{job.state === 'Dispensing' && <option value="yes">Item dispensed — keep charge</option>}<option value="no">No item dispensed — restore stock and settle payment</option></select></label>
        <label>Inspection note<input name="reason" required minLength={3} maxLength={200} disabled={busy} /></label>
        <label><input type="checkbox" required disabled={busy} /> Device stopped and physical outcome checked</label>
        <Button type="submit" disabled={busy}>Record confirmed outcome</Button></>}</form>)}
    </section></>;
}
