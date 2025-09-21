import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://osjqpxscuycbgtbojngb.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zanFweHNjdXljYmd0Ym9qbmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MTIyNDIsImV4cCI6MjA3Mzk4ODI0Mn0.8LK5f23Jy6-9QieBC9L_Xto0EwMJwjCeeBG2mCpn1sw';

const isServer = typeof globalThis !== 'undefined' && (globalThis as any).window === undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use AsyncStorage only on client to avoid SSR "window is not defined"
    storage: isServer ? undefined : (AsyncStorage as any),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
