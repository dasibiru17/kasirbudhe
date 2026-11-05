import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase Cloud Database untuk Toko Sejahtera.
// Nilai diambil dari environment (Vercel / .env lokal). Jangan hardcode kunci di sini.
// URL asli project saja (tanpa /rest/v1/ atau /auth/v1/) — path itu ditambahkan otomatis
// oleh supabase-js. Kalau terlanjur ikut, dibersihkan agar login tidak error 404.
const normalizeSupabaseUrl = (v) =>
	String(v ?? '')
		.trim()
		.replace(/\/+$/, '')
		.replace(/\/(rest|auth)\/v1$/, '');

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Mode lokal (localhost / localStorage tanpa database eksternal) aktif secara default.
 * Database Supabase hanya diaktifkan bila VITE_LOCAL_MODE diset eksplisit ke 'false'
 * DAN kredensial Supabase tersedia.
 */
export const isLocalMode = String(import.meta.env.VITE_LOCAL_MODE ?? 'true').trim() !== 'false';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && !isLocalMode;

export const supabase = isSupabaseConfigured
	? createClient(supabaseUrl, supabaseAnonKey, {
			auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
		})
	: null;
