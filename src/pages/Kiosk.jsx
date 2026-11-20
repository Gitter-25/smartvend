import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const pendingKey = 'smartvend-kiosk-pending';
const terminalStates = ['Completed', 'Cancelled', 'Refunded'];
const money = (amount) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount ?? 0);

async function request(path, body) {
  const response = await fetch(`/api/kiosk/${path}`, {
    cache: 'no-store',
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to connect to SmartVend.');
  return result;
}

// Public touch-screen checkout; never reads the administrator context or credentials.
export default function Kiosk() {
  const [catalog, setCatalog] = useState(null);
  const [order, setOrder] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function refreshCatalog() {
    try {
      setCatalog(await request('products'));
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function refreshOrder(id) {
    if (pending.current) return;
    pending.current = true;
    try {
      const next = await request(`checkout/${id}`);
      setOrder(next);
      setError('');
      if (terminalStates.includes(next.state)) sessionStorage.removeItem(pendingKey);
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
    }
  }

  useEffect(() => {
    refreshCatalog();
    const saved = sessionStorage.getItem(pendingKey);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) refreshOrder(saved);
    const interval = setInterval(() => {
      if (!sessionStorage.getItem(pendingKey)) refreshCatalog();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!order || terminalStates.includes(order.state)) return undefined;
    const interval = setInterval(() => refreshOrder(order.requestId), 3500);
    return () => clearInterval(interval);
  }, [order?.requestId, order?.state]);

  useEffect(() => {
    let active = true;
    setQr('');
    if (order?.checkoutUrl && order.state === 'AwaitingPayment') {
      QRCode.toDataURL(order.checkoutUrl, { width: 340, margin: 2 })
        .then((value) => {
          if (active) setQr(value);
        })
        .catch(() => {
          if (active) setError('Unable to display payment QR.');
        });
    }
    return () => {
      active = false;
    };
  }, [order?.checkoutUrl, order?.state]);

  async function checkout(slot) {
    setBusy(true);
    setError('');
    try {
      const next = await request('checkout', { slot });
      sessionStorage.setItem(pendingKey, next.requestId);
      setOrder(next);
    } catch (failure) {
      setError(failure.message);
      await refreshCatalog();
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (order && !terminalStates.includes(order.state)) return;
    sessionStorage.removeItem(pendingKey);
    setOrder(null);
    setQr('');
    setError('');
    refreshCatalog();
  }

  const messages = {
    AwaitingPayment: 'Scan this QR code with your phone and complete the test payment.',
    Authorized: 'Payment verified. Waiting for the vending machine to start.',
    Dispensing: 'Payment verified. Your product is being dispensed.',
    Completed: 'Purchase complete. Please collect your product.',
    Cancelled: 'Checkout expired or was cancelled. No product was dispensed.',
    RefundPending: 'Dispensing needs inspection. Please ask an attendant for assistance.',
    Refunded: 'Refund confirmed. Please ask an attendant for assistance.',
  };

  return (
    <div className="kiosk">
      <header className="kiosk-header">
        <div>
          <strong>SmartVend</strong>
          <span>SELF-SERVICE VENDING</span>
        </div>
        <span className="kiosk-test">PAYMONGO SANDBOX · NO REAL MONEY</span>
      </header>
      <main className="kiosk-main">
        {order ? (
          <section className="kiosk-order" aria-live="polite">
            <p className="kiosk-eyebrow">YOUR CHECKOUT</p>
            <h1>{order.product}</h1>
            <p className="kiosk-price">{money(order.amount)}</p>
            <p className="kiosk-message">{messages[order.state] || 'Checking purchase status…'}</p>
            {order.state === 'AwaitingPayment' && (
              <div className="kiosk-qr">
                {qr ? (
                  <img src={qr} alt="Scan to pay through PayMongo test checkout" />
                ) : (
                  'Preparing QR code…'
                )}
              </div>
            )}
            {['Authorized', 'Dispensing'].includes(order.state) && (
              <div className="kiosk-spinner" aria-label="Waiting for machine" />
            )}
            <p className="kiosk-reference">Reference: {order.requestId}</p>
            {terminalStates.includes(order.state) && (
              <button className="kiosk-primary" onClick={reset}>
                Back to products
              </button>
            )}
            {!terminalStates.includes(order.state) && (
              <p className="kiosk-warning">
                Do not start another purchase until this order is resolved. Ask an attendant if it
                remains pending.
              </p>
            )}
          </section>
        ) : (
          <>
            <div className="kiosk-intro">
              <p className="kiosk-eyebrow">WELCOME TO SMARTVEND</p>
              <h1>Choose your snack.</h1>
              <p>Tap a product to generate a QR code and pay with your phone.</p>
            </div>
            <div className="kiosk-products">
              {catalog?.products?.map((product) => (
                <article className="kiosk-product" key={product.id}>
                  <div className="kiosk-product-art" aria-hidden="true">
                    0{product.id}
                  </div>
                  <p className="kiosk-eyebrow">SLOT {product.id}</p>
                  <h2>{product.name}</h2>
                  <p>{product.stock > 0 ? `${product.stock} available` : 'Out of stock'}</p>
                  <strong>{money(product.price)}</strong>
                  <button
                    className="kiosk-primary"
                    disabled={busy || catalog.busy || product.stock < 1}
                    onClick={() => checkout(product.id)}
                  >
                    {busy ? 'Preparing…' : 'Select product'}
                  </button>
                </article>
              ))}
            </div>
            {catalog?.busy && (
              <p className="kiosk-warning">Machine is processing another order. Please wait.</p>
            )}
            {!catalog && !error && <p role="status">Loading products…</p>}
          </>
        )}
        {error && (
          <p className="kiosk-error" role="alert">
            {error}
          </p>
        )}
      </main>
      <footer className="kiosk-footer">
        SmartVend · Two-slot vending machine · Test transactions only
      </footer>
    </div>
  );
}
