import { createClient } from '@supabase/supabase-js';

// Intentamos leer ambas versiones (con y sin prefijo) para mayor compatibilidad
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("ADVERTENCIA: No se encontraron las variables de configuración de Supabase.");
}

// Único cliente de Supabase para toda la aplicación
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
