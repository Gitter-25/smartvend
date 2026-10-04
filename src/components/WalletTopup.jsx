import PendingRecovery from './PendingRecovery';
import { pendingStore } from '../lib/pending-request';
import { useAuth } from '../data/AuthContext';
import { useState } from 'react';
import { useData } from '../data/AppData';
import { pesos } from '../lib/format';
import Button from './Button';
import Input from './Input';

// Let an admin credit one student's wallet and create a matching receipt.
export default function WalletTopup() {
  const { students, topupWallet } = useData();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { session } = useAuth();
  const store = pendingStore(`${session?.user.id ?? 'demo'}:topup`);
  const student = students.find((row) => row.id === (selected || students[0]?.id));

  // Reuse the request ID when retrying an uncertain response to prevent duplicate credit.
  async function submitTopup(event) {
    event.preventDefault();
    if (busy || !student) return;
    const form = event.currentTarget;
    const value = new FormData(form).get('amount').trim();
    const amount = Number(value);
    if (!/^\d+(\.\d{1,2})?$/.test(value) || amount < 1 || amount > 10000) return setMessage('Enter ₱1–₱10,000 with at most two decimal places.');
    setBusy(true); setMessage('');
    try {
      let pending = store.read();
      if (pending && (pending.student !== student.id || pending.amount !== amount)) throw new Error(`Resolve the saved top-up first: student ${pending.student}, amount ₱${pending.amount}.`);
      pending ??= store.save({ student: student.id, amount, request_id: crypto.randomUUID() });
      await topupWallet(pending);
      store.clear();
      form.reset(); setMessage(`${pesos(amount)} credited to ${student.name}.`);
    } catch (error) { if (error.definitive) store.clear(); setMessage(`${error.message} Retry the same amount if the response was interrupted.`); }
    finally { setBusy(false); }
  }
  return <section className="card"><h3>Admin top-up</h3><p>Manually add project wallet credit and record a completed transaction.</p>
    <p>After an interrupted response, select the same student and amount to safely retry—even after a reload.</p><form onSubmit={submitTopup}>
      <label htmlFor="wallet-student">Student<select id="wallet-student" value={student?.id || ''} disabled={busy} onChange={(event) => setSelected(event.target.value)}>
        {!students.length && <option value="">Register a student first</option>}
        {students.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.number}</option>)}
      </select></label>
      <p>Wallet balance: <b>{pesos(student?.balance ?? 0)}</b></p>
      <Input label="Top-up amount (₱)" id="topup-amount" name="amount" type="number" min="1" max="10000" step="0.01" placeholder="100.00" required disabled={busy} />
      <Button type="submit" disabled={busy || !student}>{busy ? 'Saving…' : 'Add wallet credit'}</Button>
    </form><PendingRecovery store={store} /><p role="status">{message}</p></section>;
}
