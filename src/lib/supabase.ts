import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Único cliente de Supabase para toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
