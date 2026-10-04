import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createDeviceHandler } from '../_shared/device-handler.js';

// Keep database privileges and card encryption keys exclusively in the backend.
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createDeviceHandler({ db, deviceToken: Deno.env.get('DEVICE_TOKEN'),
  encryptionKey: Deno.env.get('CARD_ENCRYPTION_KEY'), lookupKey: Deno.env.get('CARD_LOOKUP_KEY') }));
