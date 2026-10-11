import { useState } from 'react';
import { useData } from '../data/AppData';
import { demoMode } from '../lib/api';
import Button from './Button';
import Input from './Input';

// Enroll or verify a student card through the backend encryption function.
export default function CardEnrollment() {
  const { students, manageCard } = useData();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const student = students.find((row) => row.id === (selected || students[0]?.id));

  // Send a typed UID for the software demo; the reader will provide it in Phase 7.
  async function submitCard(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const uid = new FormData(form).get('uid').trim();
    const action = event.nativeEvent.submitter?.value || 'enroll';
    if (!student) return setMessage('Register a student first.');
    setBusy(true); setMessage('');
    try {
      const result = await manageCard({ action, studentId: student.id, uid });
      form.reset();
      setMessage(result.enrolled ? 'Card enrolled with backend encryption.' : `Card matches. Status: ${result.active ? 'Active' : 'Disabled'}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="card">
    <h3>Encrypted card enrollment</h3>
    <p>{demoMode ? 'Sign in to the local server to test encrypted card enrollment.' : 'For software testing, enter a sample hexadecimal UID. The RFID reader will provide this after hardware integration.'}</p>
    <form onSubmit={submitCard}>
      <label htmlFor="card-student">Student<select id="card-student" value={student?.id || ''} onChange={(event) => setSelected(event.target.value)} disabled={busy}>
        {!students.length && <option value="">Register a student first</option>}
        {students.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.number}</option>)}
      </select></label>
      <Input label="Card UID (hexadecimal)" id="enrollment-uid" name="uid" placeholder="04:A1:B2:C3:D4:E5:F6" required maxLength={80} autoComplete="off" disabled={busy || demoMode} />
      <div className="actions">
        <Button type="submit" name="action" value="enroll" disabled={busy || demoMode || !student || !!student.cardId}>Enroll card</Button>
        <Button type="submit" name="action" value="verify" className="secondary" disabled={busy || demoMode || !student?.cardId}>Verify card</Button>
      </div>
    </form><p role="status">{message}</p>
  </section>;
}
