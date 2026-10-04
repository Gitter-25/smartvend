import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createQrHandler } from '../_shared/qr-handler.js';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createQrHandler({
  db,
  secret: Deno.env.get('PAYMONGO_TEST_SECRET_KEY'),
  deviceToken: Deno.env.get('DEVICE_TOKEN'),
  webhookSecret: Deno.env.get('PAYMONGO_TEST_WEBHOOK_SECRET'),
}));
