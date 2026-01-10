import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://osjqpxscuycbgtbojngb.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zanFweHNjdXljYmd0Ym9qbmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MTIyNDIsImV4cCI6MjA3Mzk4ODI0Mn0.8LK5f23Jy6-9QieBC9L_Xto0EwMJwjCeeBG2mCpn1sw';

const isServer = typeof globalThis !== 'undefined' && (globalThis as any).window === undefined;

// Custom fetch to ensure API key is passed in headers, not URL query params
// This helps avoid issues with corporate firewalls that block URLs containing "apikey" or long tokens
// Also handles SSL certificate issues in development
const customFetch = async (url: any, options: any = {}) => {
  const urlStr = typeof url === 'string' ? url : url?.url || url?.toString();
  
  let finalUrl = urlStr;
  
  // Check if URL has query params and clean them
  if (typeof urlStr === 'string' && urlStr.includes('?')) {
    try {
      const urlObj = new URL(urlStr);
      let changed = false;
      
      // Remove 'Apikey' or 'apikey' from query parameters if present
      if (urlObj.searchParams.has('Apikey')) {
        urlObj.searchParams.delete('Apikey');
        changed = true;
      }
      if (urlObj.searchParams.has('apikey')) {
        urlObj.searchParams.delete('apikey');
        changed = true;
      }

      if (changed) {
        finalUrl = urlObj.toString();
      }
    } catch (e) {
      // If URL parsing fails, fall back to original URL
      console.warn('Failed to parse URL in customFetch', e);
    }
  }

  // Log SSL errors for debugging
  try {
    return await fetch(finalUrl, options);
  } catch (error: any) {
    // Log certificate errors for troubleshooting
    if (error?.message?.includes('certificate') || error?.message?.includes('SSL') || error?.message?.includes('CERT')) {
      console.error('SSL/Certificate Error:', error.message);
      console.error('URL:', finalUrl);
      console.error('This may be caused by corporate network SSL inspection or invalid certificates.');
      console.error('Solutions:');
      console.error('1. Use cellular hotspot or different network');
      console.error('2. Contact IT to whitelist supabase.co');
      console.error('3. Install corporate SSL certificate in your system');
    }
    throw error;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Use AsyncStorage only on client to avoid SSR "window is not defined"
    storage: isServer ? undefined : (AsyncStorage as any),
    autoRefreshToken: true,
    persistSession: true,
    // Enable detecting session from URL hash for OAuth callbacks (web)
    detectSessionInUrl: typeof window !== 'undefined',
  },
  global: {
    fetch: customFetch,
  },
});
