import { useState } from 'react';
import { useDemo } from '../data/DemoContext';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import Input from '../components/Input';
import StatusBadge from '../components/StatusBadge';

// Register sample students, toggle cards, and preview the Maya top-up form.
export default function Students() {
  const { students, setStudents } = useDemo();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('demo-1');
  const student = students.find((item) => item.id === selected);

  // Reject blank or duplicate identifiers before adding a demo student.
  function registerStudent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get('name').trim();
    const number = data.get('number').trim().toUpperCase();
    const card = data.get('card').trim().toUpperCase();
    if (!name || !number || !card) return setMessage('Complete all three fields.');
    if (students.some((item) => item.number === number || item.card === card)) return setMessage('Student number or card is already registered.');
    setStudents([...students, { id: crypto.randomUUID(), name, number, card, balance: 0, active: true }]);
    form.reset();
    setMessage('Demo student registered. Refreshing the page resets sample data.');
  }

  // Enable or disable a card in the temporary demo data.
  function toggleCard(id) {
    setStudents(students.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  }

  return <>
    <PageHeading title="Students" description="Register cards, view wallets, and prepare student top-ups." />
    <div className="two-columns">
      <section className="card"><h3>Register student</h3><p>Use fictional details and test card identifiers in this preview.</p>
        <form onSubmit={registerStudent}>
          <Input label="Student name" id="name" name="name" required maxLength={80} />
          <Input label="Student number" id="number" name="number" required maxLength={40} />
          <Input label="Test card identifier" id="card" name="card" required maxLength={80} />
          <Button type="submit">Register student</Button>
        </form><p role="status">{message}</p>
      </section>
      <section className="card"><h3>Maya top-up</h3>
        <label htmlFor="wallet">Student<select id="wallet" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {students.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}
        </select></label>
        <p>Wallet balance: <b>{pesos(student?.balance ?? 0)}</b></p>
        <Input label="Top-up amount (₱)" id="amount" type="number" min="1" step="0.01" placeholder="100.00" />
        <Button disabled>Create Maya QR</Button><p>Maya payments will be connected in Phase 5.</p>
      </section>
    </div>
    <section className="card"><h3>Registered students</h3><div className="table-wrap"><table>
      <thead><tr><th>Name</th><th>Student number</th><th>Balance</th><th>Card status</th><th>Action</th></tr></thead>
      <tbody>{students.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.number}</td><td>{pesos(item.balance)}</td><td><StatusBadge>{item.active ? 'Active' : 'Disabled'}</StatusBadge></td><td><Button className="secondary" onClick={() => toggleCard(item.id)}>{item.active ? 'Disable' : 'Enable'} card for {item.name}</Button></td></tr>)}</tbody>
    </table></div></section>
  </>;
}
