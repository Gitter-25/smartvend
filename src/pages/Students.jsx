import { useState } from 'react';
import { useData } from '../data/AppData';
import { demoMode } from '../lib/supabase';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';
import CardEnrollment from '../components/CardEnrollment';
import WalletTopup from '../components/WalletTopup';
import StatusBadge from '../components/StatusBadge';

// Register students, manage card status, and show the wallet credit form.
export default function Students() {
  const { students, addStudent, toggleCard: persistCard } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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
      <WalletTopup />
    </div>
    <CardEnrollment />
    <section className="card"><h3>Registered students</h3><div className="table-wrap"><table>
      <thead><tr><th>Name</th><th>Student number</th><th>Balance</th><th>Card status</th><th>Action</th></tr></thead>
      <tbody>{students.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.number}</td><td>{pesos(item.balance)}</td><td><StatusBadge>{!demoMode && !item.cardId ? 'Not enrolled' : item.active ? 'Active' : 'Disabled'}</StatusBadge></td><td><Button className="secondary" disabled={busy || (!demoMode && !item.cardId)} onClick={() => toggleCard(item)}>{item.active ? 'Disable' : 'Enable'} card for {item.name}</Button></td></tr>)}</tbody>
    </table></div></section>
  </>;
}
