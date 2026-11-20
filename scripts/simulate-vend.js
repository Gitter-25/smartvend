// Manual, localhost-only simulation of one vending job.
// NEVER connect this script to actual motors or use it with live payments.
import { randomUUID } from 'node:crypto';

const endpoint = process.env.SMARTVEND_DEVICE_URL;
const token = process.env.DEVICE_TOKEN;
const [id, outcome, confirmation] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
if (
  !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/api\/device-vending$/.test(endpoint ?? '') ||
  !/^[0-9a-f]{64}$/i.test(token ?? '') ||
  !uuid.test(id ?? '') ||
  !['success', 'failure'].includes(outcome) ||
  confirmation !== '--confirm-simulated'
) {
  console.error('Usage: node --env-file=.env.server scripts/simulate-vend.js <order-uuid> <success|failure> --confirm-simulated');
  console.error('Requires SMARTVEND_DEVICE_URL=http://127.0.0.1:3001/api/device-vending and DEVICE_TOKEN.');
  console.error('SIMULATION ONLY. Use a disposable test database and sandbox payments.');
  process.exit(1);
}

async function call(action, extra = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, requestId: id, ...extra }),
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${action} returned ${response.status}: ${body.error || 'unknown error'}`);
  return body;
}

try {
  const initial = await call('status');
  console.log('Current job:', initial);
  if (initial.state !== 'Authorized') {
    console.error('Refusing to simulate: order must be Authorized. No action taken.');
    process.exitCode = 1;
  } else {
    // An Authorized order is consumed exactly once by start. Never retry start after
    // a network timeout: the server may already have moved it to Dispensing.
    const started = await call('start');
    if (started.shouldDispense !== true || started.state !== 'Dispensing') {
      throw new Error('Start did not grant a new single dispense; stop and inspect.');
    }
    console.log('SIMULATED mechanism:', outcome === 'success' ? 'one item released' : 'confirmed no item released');
    const finished = await call('finish', {
      dispensed: outcome === 'success',
      reason: `Software-only simulator ${randomUUID()}: ${outcome === 'success' ? 'simulated item passage' : 'simulated confirmed non-dispense'}; no physical mechanism or sensor was used`,
    });
    console.log('Final job:', finished);
    console.log('SIMULATION ONLY: not evidence of physical dispensing.');
    if (finished.state === 'RefundPending') {
      console.log('QR refund requires separate admin/provider verification. Do not assume automatic refund.');
    }
  }
} catch (error) {
  console.error('Simulation stopped:', error.message);
  console.error('Outcome may be uncertain. Inspect status and transaction; NEVER automatically repeat start or finish.');
  process.exitCode = 1;
}
