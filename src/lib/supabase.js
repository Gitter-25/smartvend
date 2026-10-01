import { createClient } from '@supabase/supabase-js';
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// A demo never connects to the real database.
export const supabase = !demoMode && url && key ? createClient(url, key) : null;
