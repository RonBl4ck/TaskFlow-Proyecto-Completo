import { createClient } from '@supabase/supabase-js';

// Acepta tanto la nomenclatura antigua (ANON_KEY) como la nueva (PUBLISHABLE_KEY).
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'ADVERTENCIA: Faltan variables de Supabase. Define SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL y una clave SUPABASE_ANON_KEY o SUPABASE_PUBLISHABLE_KEY.'
  );
}

// Unico cliente de Supabase para toda la aplicacion
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);
