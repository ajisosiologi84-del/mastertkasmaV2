import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default / fallback keys or from local storage / env vars
let supabaseInstance: SupabaseClient | null = null;
let currentSupabaseUrl: string = '';
let currentSupabaseKey: string = '';

const SUPABASE_STORAGE_URL_KEY = 'tka_supabase_url';
const SUPABASE_STORAGE_ANON_KEY = 'tka_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; key: string } {
  let url = '';
  let key = '';

  if (typeof window !== 'undefined') {
    url = localStorage.getItem(SUPABASE_STORAGE_URL_KEY) || '';
    key = localStorage.getItem(SUPABASE_STORAGE_ANON_KEY) || '';
  }

  // Fallback to environment variables if not found in localStorage
  const metaEnv = (import.meta as any).env || {};
  if (!url && metaEnv.VITE_SUPABASE_URL) {
    url = String(metaEnv.VITE_SUPABASE_URL).trim();
  }
  if (!key && metaEnv.VITE_SUPABASE_ANON_KEY) {
    key = String(metaEnv.VITE_SUPABASE_ANON_KEY).trim();
  }

  return { url, key };
}

export function saveStoredSupabaseConfig(url: string, key: string): void {
  currentSupabaseUrl = url.trim();
  currentSupabaseKey = key.trim();

  if (typeof window !== 'undefined') {
    if (currentSupabaseUrl) {
      localStorage.setItem(SUPABASE_STORAGE_URL_KEY, currentSupabaseUrl);
    } else {
      localStorage.removeItem(SUPABASE_STORAGE_URL_KEY);
    }

    if (currentSupabaseKey) {
      localStorage.setItem(SUPABASE_STORAGE_ANON_KEY, currentSupabaseKey);
    } else {
      localStorage.removeItem(SUPABASE_STORAGE_ANON_KEY);
    }
  }

  // Reset current client so it re-initializes on next call
  supabaseInstance = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseConfig();

  if (!url || !key) {
    return null;
  }

  if (supabaseInstance && currentSupabaseUrl === url && currentSupabaseKey === key) {
    return supabaseInstance;
  }

  try {
    currentSupabaseUrl = url;
    currentSupabaseKey = key;
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    return null;
  }
}

export const SUPABASE_SQL_SETUP_CODE = `-- =========================================================================
-- SCRIPT SQL UNTUK TABEL DATABASE PENGGUNA TKA SMA DI SUPABASE
-- Buka dashboard Supabase -> SQL Editor -> Klik "New Query" -> Tempel & Run
-- =========================================================================

-- 1. Buat Tabel Users
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  mata_pelajaran TEXT NOT NULL DEFAULT 'Sosiologi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan Keamanan / RLS Policies (Bisa membaca & mengelola data akun)
DROP POLICY IF EXISTS "Public Read Users" ON public.users;
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Insert Users" ON public.users;
CREATE POLICY "Public Insert Users" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Users" ON public.users;
CREATE POLICY "Public Update Users" ON public.users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public Delete Users" ON public.users;
CREATE POLICY "Public Delete Users" ON public.users FOR DELETE USING (true);

-- 4. Tambahkan Akun Awal (Admin & Guru Default)
INSERT INTO public.users (id, email, password, name, role, mata_pelajaran)
VALUES 
  ('usr_admin', 'admin@tka.com', 'admin123', 'Admin TKA SMA', 'admin', 'Sosiologi'),
  ('usr_demo', 'user@tka.com', 'user123', 'Guru Sosiologi', 'user', 'Sosiologi')
ON CONFLICT (email) DO NOTHING;
`;
