export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// Call the same-origin Express server; browser JavaScript never receives a session secret.
export async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Local API unavailable. Start npm run server and retry.'); }
  if (!response.ok) {
    const error = new Error(result.error || 'Request failed');
    error.status = response.status;
    error.definitive = [400, 404, 409].includes(response.status);
    throw error;
  }
  return result;
}
// Adapt a request for views that display a returned error alongside the data.
export async function apiResult(path, body) {
  try { return { data: await api(path, body), error: null }; }
  catch (error) { return { data: null, error }; }
}
