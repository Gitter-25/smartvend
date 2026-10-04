// Send one explicit test request; never automatically authorize, dispense, or refund.
const endpoint = process.env.SMARTVEND_DEVICE_URL;
const token = process.env.DEVICE_TOKEN;
const input = process.argv[2];
if (!(endpoint?.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(endpoint ?? '')) || !token || !input) {
  console.error('Set SMARTVEND_DEVICE_URL and DEVICE_TOKEN, then pass a JSON request body.');
  process.exit(1);
}
let body;
try { body = JSON.parse(input); } catch { console.error('Invalid JSON request.'); process.exit(1); }
try {
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  console.log(response.status, await response.text());
  if (!response.ok) process.exitCode = 1;
} catch {
  console.error('Response uncertain. Keep the same request ID; use status. Never repeat physical actuation.');
  process.exitCode = 1;
}
