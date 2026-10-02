import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createCardHandler } from '../_shared/card-handler.js';

// The service-role key and encryption keys exist only in Supabase's backend.
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createCardHandler({
  db,
  encryptionKey: Deno.env.get('CARD_ENCRYPTION_KEY'),
  lookupKey: Deno.env.get('CARD_LOOKUP_KEY'),
}));
