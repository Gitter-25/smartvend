import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useAuth } from '../data/AuthContext';
import { useData } from '../data/AppData';
import { api, apiResult, demoMode } from '../lib/api';
import { pendingStore } from '../lib/pending-request';
import { pesos } from '../lib/format';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';

// Invoke the authenticated payment backend without accepting browser payment assertions.
async function requestQr(body) {
  return api('/qr-payments', body);
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
    const result = await apiResult('/qr-orders');
    if (result.error) { setError('QR data unavailable. Start the local Express server.'); return; }
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
      const result = await apiResult(`/qr-orders/${saved.requestId}`);
      if (result.error || result.data) { setError('Check or cancel the saved order before starting another.'); return; }
    }
    store.clear(); setSaved(null); setOrder(null); setError('');
  }

  const product = products.find((row) => row.id === slot);
  const verified = order && ['Authorized', 'Dispensing', 'Completed', 'RefundPending', 'Refunded'].includes(order.state);
  const dispenseLabel = order?.state === 'Completed' ? 'Outcome recorded'
    : ['RefundPending', 'Refunded'].includes(order?.state) ? 'Not dispensed'
    : order?.state === 'Cancelled' ? 'Cancelled' : 'Awaiting outcome';
  const guidance = {
    AwaitingPayment: 'Scan the QR with your phone camera, choose GCash, and authorize the test payment.',
    Authorized: 'The API verified this payment. Waiting for a device request to start dispensing.',
    Dispensing: 'Waiting for a confirmed device outcome. Do not repeat an uncertain dispense.',
    Completed: 'Payment and dispense outcome have been recorded. For this software demo, dispensing is simulated.',
    Cancelled: 'The unpaid checkout has been cancelled and its reserved stock restored.',
    RefundPending: 'Stock has been restored. Complete the provider refund, then verify it below.',
    Refunded: 'The full PayMongo test refund has been verified. Stock is restored and no student wallet was credited.',
  };
  return <><PageHeading title="QR payments" description="PayMongo sandbox checkout. No real money or student wallet deductions." />
    <div className="qr-layout">
      <section className="card qr-checkout"><div className="section-heading"><div><p className="eyebrow">PAY WITH YOUR PHONE</p><h3>Test checkout</h3></div><StatusBadge>Sandbox only</StatusBadge></div>
        <label htmlFor="qr-slot">Product slot<select id="qr-slot" value={slot} disabled={busy || !!saved || demoMode} onChange={(event) => setSlot(Number(event.target.value))}>
          {products.map((product) => <option key={product.id} value={product.id}>Slot {product.id}: {product.name} · {pesos(product.price)} · stock {product.stock}</option>)}
        </select></label>
        {!order && <><div className="checkout-placeholder"><span className="placeholder-icon"><Icon name="qr" size={38} /></span><h4>Your checkout QR will appear here</h4><p>Create a checkout, then scan it with your phone camera to open PayMongo’s test payment page.</p></div>
          <Button disabled={busy || demoMode || !products.length || (!saved && !product?.stock)} onClick={create}>{busy ? 'Preparing checkout…' : saved ? 'Retry saved checkout request' : 'Create test checkout'}<Icon name="arrow" size={16} /></Button>
          {!saved && product?.stock === 0 && <p className="helper-text">This slot is out of stock. Restock it or choose another slot.</p>}
        </>}
        {saved && <div className="reference-box"><small>Order reference</small><span className="reference">{saved.requestId}</span></div>}
        {(busy || error) && <p className="form-message" role="status">{busy ? 'Checking payment and dispense status…' : error}</p>}
        {order && <><div className="payment-summary"><div><h3>{order.product}</h3><p>Slot {order.slot} · PayMongo test payment</p></div><strong>{pesos(order.amount)}</strong></div>
          <StatusBadge>{order.state}</StatusBadge>
          <ol className="payment-steps" aria-label="Payment progress"><li className="reached"><span>1. Checkout</span>Order created</li><li className={verified ? 'reached' : ''}><span>2. Payment</span>{verified ? 'API verified' : order.state === 'Cancelled' ? 'Unpaid' : 'Awaiting payment'}</li><li className={order.state === 'Completed' ? 'reached' : ''}><span>3. Dispense</span>{dispenseLabel}</li></ol>
          <p>{guidance[order.state]}</p>
          {order.state === 'AwaitingPayment' && order.checkoutUrl && <div className="qr-display">{image && <img src={image} width="320" height="320" alt="Scan to open PayMongo sandbox checkout" />}<p>Choose GCash, then authorize the test payment. Do not enter real payment credentials.</p><a className="checkout-link" href={order.checkoutUrl} target="_blank" rel="noopener noreferrer">Open test checkout ↗</a></div>}
          {order.state === 'AwaitingPayment' && <Button className="secondary" disabled={busy || !order.sessionId} onClick={() => run('cancel')}>Expire checkout & check cancellation</Button>}
          {order.recoveryRequired && <form onSubmit={(event) => { event.preventDefault(); run('recover', { sessionId: new FormData(event.currentTarget).get('sessionId').trim() }); }}>
            <p>Checkout creation was interrupted. Find this order reference in PayMongo test mode, then recover its session. Retain this order for recovery.</p>
            <label htmlFor="qr-session">PayMongo checkout reference<input id="qr-session" name="sessionId" placeholder="cs_…" required maxLength={103} /></label><Button type="submit" disabled={busy}>Verify & recover checkout</Button>
          </form>}
          {order.state === 'RefundPending' && <form onSubmit={(event) => { event.preventDefault(); run('refund', { refundId: new FormData(event.currentTarget).get('refundId').trim() }); }}>
            <p>Refund payment <span className="reference">{order.paymentId}</span> in PayMongo test mode, then enter the full refund reference. No student wallet will be credited.</p>
            <label htmlFor="qr-refund">Completed provider refund<input id="qr-refund" name="refundId" placeholder="ref_…" required maxLength={104} /></label><Button type="submit" disabled={busy}>Verify sandbox refund</Button>
          </form>}
          <p className="helper-text"><Link to="/machine">Device contact & outcome recovery →</Link></p>
        </>}
        {saved && <div className="actions"><Button className="secondary" disabled={busy} onClick={() => run('status')}>Check status</Button><Button className="secondary" disabled={busy || (!!order && !terminal)} onClick={clear}>{terminal ? 'Start another checkout' : 'Clear reference if no order exists'}</Button></div>}
        {demoMode && <p className="helper-text">QR payments are disabled in the sample-data preview. Sign in to the local server to use PayMongo test mode.</p>}
      </section>
      <section className="card"><div className="section-heading"><div><p className="eyebrow">PAYMENT HISTORY</p><h3>Recent QR orders</h3></div><Button className="secondary" disabled={busy || demoMode} onClick={refreshRecent}>Refresh</Button></div>
        {!recent.length && <div className="empty-state"><Icon name="transactions" size={28} /><h4>No QR orders yet</h4><p>Your test checkouts and their latest states will appear here.</p></div>}
        <div className="order-list">{recent.map((row) => <button className={`order-row ${saved?.requestId === row.id ? 'selected' : ''}`} key={row.id} disabled={busy} title={row.id} aria-label={`Open order ${row.id}, ${row.vend_jobs.state}`} onClick={() => reopen(row.id)}><span><span className="reference">{row.id.slice(0, 8)}…{row.id.slice(-4)}</span><small>{new Date(row.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span><StatusBadge>{row.vend_jobs.state}</StatusBadge></button>)}</div>
        <div className="qr-guidance"><h4><Icon name="shield" size={16} /> Verified by the backend</h4><p>Payment confirmation comes from the PayMongo API or a signed webhook. Dispensing requires a separate device outcome. The browser never drives a motor.</p></div>
      </section>
    </div></>;
}
