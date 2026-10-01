import { Link } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';

// Preview the login screen before Supabase authentication is connected.
export default function Login() {
  return (
    <div className="login"><section className="card">
      <p className="eyebrow">SMARTVEND</p><h2>Admin login</h2>
      <p>Authentication will be connected in Phase 3.</p>
      <Input label="Email" id="email" type="email" autoComplete="username" />
      <Input label="Password" id="password" type="password" autoComplete="current-password" />
      <Button disabled>Sign in — coming in Phase 3</Button>
      <Link to="/dashboard">Open setup preview</Link>
    </section></div>
  );
}
