import { useState } from 'react';
import { api, apiResult, demoMode } from '../lib/api';
import Button from './Button';

// Resolve a lost success response using its saved receipt without charging again.
export default function PendingRecovery({ store }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function checkReceipt() {
    setBusy(true);
    try {
      const pending = store.read();
      if (!pending) { setMessage('No saved request to recover.'); return; }
      const id = pending.request_id || pending.requestId;
      const { data, error } = await apiResult(`/receipts/${id}`);
      if (error) throw error;
      if (data) {
        store.clear(); setMessage(`${data.type} already recorded: ₱${data.amount} · ${data.status === 'Reversed' ? 'Refunded' : data.status}. Saved retry cleared.`);
      } else {
        const details = pending.identity ? `Student ${pending.identity.split(':')[0]}, Slot ${pending.identity.split(':')[1]}; enter the same card.` : `Student ${pending.student}, amount ₱${pending.amount}.`;
        setMessage(`No receipt found yet. Retry the original entry with its saved ID. ${details}`);
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return demoMode ? null : <div><Button type="button" onClick={checkReceipt} disabled={busy}>{busy ? 'Checking…' : 'Check saved request receipt'}</Button><p role="status">{message}</p></div>;
}
