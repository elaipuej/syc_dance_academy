import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  console.warn('Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local');
}

export const supabase = url && publishableKey
  ? createClient(url, publishableKey)
  : null;
