import { useState } from 'react';
import { useData } from '../data/AppData';
import { demoMode } from '../lib/supabase';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';
import CardEnrollment from '../components/CardEnrollment';
import StatusBadge from '../components/StatusBadge';

// Register students, toggle cards, and preview the Maya top-up form.
export default function Students() {
  const { students, addStudent, toggleCard: persistCard } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const student = students.find((item) => item.id === (selected || students[0]?.id));

  // Reject blank or duplicate identifiers before adding a student.
  async function registerStudent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get('name').trim();
    const number = data.get('number').trim().toUpperCase();
    const card = demoMode ? data.get('card').trim().toUpperCase() : null;
    if (!name || !number || (demoMode && !card)) return setMessage('Complete all required fields.');
    if (students.some((item) => item.number === number || (card && item.card === card))) return setMessage('Student number or card is already registered.');
    setBusy(true);
    try {
      await addStudent({ name, number, card });
      form.reset(); setMessage('Student registered with a zero-balance wallet.');
    } catch (error) { setMessage(error.code === '23505' ? 'Student number is already registered.' : error.message); }
    finally { setBusy(false); }
  }

  // Enable or disable a card in the shared admin data.
  async function toggleCard(student) {
    setBusy(true);
    try { await persistCard(student); setMessage('Card status updated.'); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Students" description="Register cards, view wallets, and prepare student top-ups." />
    <div className="two-columns">
      <section className="card"><h3>Register student</h3><p>{demoMode ? 'Use fictional details and test card identifiers in this preview.' : 'Register the student now. Use the enrollment form below to link an encrypted card.'}</p>
        <form onSubmit={registerStudent}>
          <Input label="Student name" id="name" name="name" required maxLength={80} />
          <Input label="Student number" id="number" name="number" required maxLength={40} />
          {demoMode && <Input label="Test card identifier" id="card" name="card" required maxLength={80} />}
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Register student'}</Button>
        </form><p role="status">{message}</p>
      </section>
      <section className="card"><h3>Maya top-up</h3>
        <label htmlFor="wallet">Student<select id="wallet" value={selected || students[0]?.id || ''} onChange={(event) => setSelected(event.target.value)}>
          {students.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}
        </select></label>
        <p>Wallet balance: <b>{pesos(student?.balance ?? 0)}</b></p>
        <Input label="Top-up amount (₱)" id="amount" type="number" min="1" step="0.01" placeholder="100.00" />
        <Button disabled>Create Maya QR</Button><p>Maya payments will be connected in Phase 5.</p>
      </section>
    </div>
    <CardEnrollment />
    <section className="card"><h3>Registered students</h3><div className="table-wrap"><table>
      <thead><tr><th>Name</th><th>Student number</th><th>Balance</th><th>Card status</th><th>Action</th></tr></thead>
      <tbody>{students.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.number}</td><td>{pesos(item.balance)}</td><td><StatusBadge>{!demoMode && !item.cardId ? 'Not enrolled' : item.active ? 'Active' : 'Disabled'}</StatusBadge></td><td><Button className="secondary" disabled={busy || (!demoMode && !item.cardId)} onClick={() => toggleCard(item)}>{item.active ? 'Disable' : 'Enable'} card for {item.name}</Button></td></tr>)}</tbody>
    </table></div></section>
  </>;
}
