import { useRef, useState } from 'react';
import { useData } from '../data/AppData';
import { demoMode } from '../lib/supabase';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';

// Test a card purchase before connecting the physical vending machine.
export default function Purchase() {
  const { students, products, manageCard } = useData();
  const [studentId, setStudentId] = useState('');
  const [slot, setSlot] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(null);
  const student = students.find((row) => row.id === (studentId || students[0]?.id));

  // Send the card and slot; the backend determines the price and checks funds.
  async function submitPurchase(event) {
    event.preventDefault();
    if (busy || !student || demoMode) return;
    const form = event.currentTarget;
    const uid = new FormData(form).get('uid').trim();
    const identity = `${student.id}:${slot}:${uid.replace(/[\s:-]/g, '').toUpperCase()}`;
    if (pending.current?.identity !== identity) pending.current = { identity, requestId: crypto.randomUUID() };
    setBusy(true); setMessage('');
    try {
      const result = await manageCard({ action: 'purchase', studentId: student.id, slot, uid, requestId: pending.current.requestId });
      pending.current = null; form.reset();
      setMessage(`Simulated purchase completed: ${pesos(result.amount)}. Wallet and stock updated. Reference: ${result.transactionId}`);
    } catch (error) { setMessage(`${error.message} If the response was interrupted, retry the same entry.`); }
    finally { setBusy(false); }
  }
  return <><PageHeading title="Purchase test" description="Software simulation only. No physical item is dispensed." />
    <section className="card"><form onSubmit={submitPurchase}>
      <label htmlFor="purchase-student">Student<select id="purchase-student" value={student?.id || ''} disabled={busy} onChange={(event) => setStudentId(event.target.value)}>
        {!students.length && <option value="">Register a student first</option>}
        {students.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.number}</option>)}
      </select></label><p>Wallet: {pesos(student?.balance ?? 0)}</p>
      <label htmlFor="purchase-slot">Slot<select id="purchase-slot" value={slot} disabled={busy} onChange={(event) => setSlot(Number(event.target.value))}>
        {products.map((row) => <option key={row.id} value={row.id}>Slot {row.id}: {row.name} · {pesos(row.price)} · Stock {row.stock}</option>)}
      </select></label>
      <Input label="Enrolled card UID" id="purchase-uid" name="uid" required maxLength={80} autoComplete="off" disabled={busy || demoMode} />
      <Button type="submit" disabled={busy || demoMode || !student}>{busy ? 'Processing…' : 'Simulate purchase'}</Button>
    </form><p role="status">{message}</p>{demoMode && <p>Connect Supabase to test encrypted purchases.</p>}</section></>;
}
