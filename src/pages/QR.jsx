import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../data/AuthContext';
import { useData } from '../data/AppData';
import { supabase, demoMode } from '../lib/supabase';
import { pendingStore } from '../lib/pending-request';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';

// Invoke the authenticated payment backend without accepting browser payment assertions.
async function requestQr(body) {
  const { data, error } = await supabase.functions.invoke('qr-payments', { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error ?? message; } catch { /* Network errors may not have JSON. */ }
    throw new Error(message);
  }
  return data;
}

// Display a provider checkout QR and recover the saved request after a browser reload.
export default function QR() {
  const { session } = useAuth();
  const { products, loadData } = useData();
  const store = pendingStore(`${session?.user.id ?? 'demo'}:qr`);
  const [slot, setSlot] = useState(1);
  const [order, setOrder] = useState(null);
  const [saved, setSaved] = useState(() => store.read());
  const [recent, setRecent] = useState([]);
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const terminal = order && ['Completed', 'Refunded', 'Cancelled'].includes(order.state);

  // Include server-side orders created on another browser or by the ESP32.
  async function refreshRecent() {
    if (demoMode) return;
    const result = await supabase.from('qr_orders').select('id,created_at,vend_jobs(state)').order('created_at', { ascending: false }).limit(20);
    if (result.error) { setError('QR data unavailable. Apply migration 008 and deploy qr-payments.'); return; }
    setRecent(result.data);
  }
  useEffect(() => { refreshRecent(); }, []);

  // Render the checkout URL locally; no external QR service receives the payment link.
  useEffect(() => {
    let active = true;
    setImage('');
    if (order?.checkoutUrl) QRCode.toDataURL(order.checkoutUrl, { width: 320, margin: 4, errorCorrectionLevel: 'M' })
      .then((value) => { if (active) setImage(value); }).catch(() => { if (active) setError('Could not render QR. Use the checkout link below.'); });
    return () => { active = false; };
  }, [order?.checkoutUrl]);

  // Serialize requests and retain the original ID whenever a response is interrupted.
  async function run(action, extra = {}, reference = saved?.requestId) {
    if (working.current || demoMode || !reference) return;
    working.current = true; setBusy(true); setError('');
    try {
      const next = await requestQr({ action, requestId: reference, ...extra });
      setOrder(next);
      const value = store.save({ requestId: reference, slot: next.slot });
      setSaved(value); setSlot(next.slot);
      await refreshRecent(); await loadData();
    } catch (failure) { setError(failure.message); }
    finally { working.current = false; setBusy(false); }
  }

  // Poll only while waiting for payment/dispensing, with one request at a time.
  useEffect(() => {
    if (!saved?.requestId || demoMode) return;
    run('status', {}, saved.requestId);
    const timer = setInterval(() => {
      if (!document.hidden && !terminal) run('status', {}, saved.requestId);
    }, 5000);
    return () => clearInterval(timer);
  }, [saved?.requestId, terminal]);

  // Save the request before contacting either backend so a reload cannot duplicate it.
  async function create() {
    if (working.current || demoMode) return;
    try {
      const pending = saved ?? store.save({ requestId: crypto.randomUUID(), slot });
      setSaved(pending);
      await run('create', { slot: pending.slot }, pending.requestId);
    } catch (failure) { setError(failure.message); }
  }

  // Reopen an existing server order without creating a new checkout.
  function reopen(id) {
    const value = store.save({ requestId: id });
    setOrder(null); setSaved(value);
    run('status', {}, id);
  }

  // Clear only a verified terminal order, or a locally saved ID with no server order.
  async function clear() {
    if (working.current) return;
    if (!terminal && saved) {
      const result = await supabase.from('qr_orders').select('id').eq('id', saved.requestId).maybeSingle();
      if (result.error || result.data) { setError('Check or cancel the saved order before starting another.'); return; }
    }
    store.clear(); setSaved(null); setOrder(null); setError('');
  }

  return <><PageHeading title="QR test payments" description="PayMongo sandbox API · no real money · student wallets stay unchanged" />
    <section className="card"><p>Scan with your phone camera to open the test checkout. Choose GCash and complete the provider's test authorization. Do not enter real payment credentials.</p>
      <label>Product slot<select value={slot} disabled={busy || !!saved || demoMode} onChange={(event) => setSlot(Number(event.target.value))}>
        {products.map((product) => <option key={product.id} value={product.id}>Slot {product.id}: {product.name} · {pesos(product.price)} · stock {product.stock}</option>)}
      </select></label>
      {!order && <Button disabled={busy || demoMode || !products.length} onClick={create}>{saved ? 'Retry saved checkout request' : 'Create test checkout'}</Button>}
      {saved && <><p>Reference: {saved.requestId}</p><Button disabled={busy} onClick={() => run('status')}>Check payment and dispense status</Button></>}
      <p role="status">{busy ? 'Checking…' : error}</p>
      {order && <><h3>{order.product} · {pesos(order.amount)}</h3><p>Test payment · {order.state}</p>
        {image && <img src={image} width="320" height="320" style={{ maxWidth: '100%', height: 'auto' }} alt="Scan to open PayMongo sandbox checkout" />}
        {order.checkoutUrl && <p><a href={order.checkoutUrl} target="_blank" rel="noopener noreferrer">Open test checkout</a></p>}
        {order.state === 'AwaitingPayment' && <Button disabled={busy || !order.sessionId} onClick={() => run('cancel')}>Expire checkout and check cancellation</Button>}
        {order.state === 'Authorized' && <p>API payment verified. Waiting for the device to dispense. The browser does not drive a motor.</p>}
        {order.state === 'Dispensing' && <p>Waiting for a confirmed device outcome. If uncertain, stop and inspect the machine.</p>}
        {order.recoveryRequired && <form onSubmit={(event) => { event.preventDefault(); run('recover', { sessionId: new FormData(event.currentTarget).get('sessionId').trim() }); }}>
          <p>Checkout creation was interrupted. Find this reference in PayMongo test mode, then recover its session. Do not create another payment for this order.</p>
          <label>PayMongo checkout reference<input name="sessionId" placeholder="cs_…" required maxLength={103} /></label><Button type="submit" disabled={busy}>Verify and recover checkout</Button>
        </form>}
        {order.state === 'RefundPending' && <form onSubmit={(event) => { event.preventDefault(); run('refund', { refundId: new FormData(event.currentTarget).get('refundId').trim() }); }}>
          <p>Stock has been restored. Refund payment {order.paymentId} in PayMongo test mode, then enter the full refund reference. No student wallet will be credited.</p>
          <label>Completed provider refund<input name="refundId" placeholder="ref_…" required maxLength={104} /></label><Button type="submit" disabled={busy}>Verify sandbox refund</Button>
        </form>}
        <p><Link to="/machine">Machine status and physical outcome recovery</Link></p>
      </>}
      {saved && <Button disabled={busy || (!!order && !terminal)} onClick={clear}>{terminal ? 'Start another checkout' : 'Clear reference only if no order exists'}</Button>}
      {demoMode && <p>Connect Supabase and configure PayMongo test mode to use this feature.</p>}
    </section>
    <section className="card"><h3>Recent QR orders</h3><Button disabled={busy || demoMode} onClick={refreshRecent}>Refresh orders</Button>
      {recent.map((row) => <p key={row.id}><Button disabled={busy} onClick={() => reopen(row.id)}>{row.id}</Button> · {row.vend_jobs.state}</p>)}
    </section></>;
}
