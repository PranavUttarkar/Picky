// Build a proxy URL for remote images to avoid hotlink rate-limits (429) and enable CDN caching
// Strategy:
// - If EXPO_PUBLIC_IMAGE_PROXY_BASE is set (e.g., https://your-domain.vercel.app/api/image-proxy), use it: `${base}?u=<url>&w=<w>&h=<h>`
// - Otherwise DO NOT proxy (return the original URL). We intentionally removed public fallback proxies to avoid 404s.
// - Never proxy data:image/* or localhost/dev assets.

const DATA_URI = /^data:image\//i;
const HTTP_URI = /^https?:\/\//i;

// Domains we trust and do not proxy (your own storage/CDN)
const FIRST_PARTY_HOST_SUFFIXES = [
  '.supabase.co', // Supabase Storage public URLs
  'localhost',
  '127.0.0.1',
];

function isFirstPartyHost(hostname: string) {
  const h = hostname.toLowerCase();
  return FIRST_PARTY_HOST_SUFFIXES.some((s) => h === s || h.endsWith(s));
}

export function proxiedImageUrl(url: string, width?: number | undefined, height?: number | undefined): string {
  if (!url) return url;
  if (DATA_URI.test(url)) return url; // keep inline images
  if (!HTTP_URI.test(url)) return url; // not a remote URL we can proxy
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (isFirstPartyHost(parsed.hostname)) return url; // trust our own CDN/storage

  const w = typeof width === 'number' && width > 0 ? Math.round(width) : undefined;
  const h = typeof height === 'number' && height > 0 ? Math.round(height) : undefined;

  // Prefer app-configured proxy if available
  const base = (process.env.EXPO_PUBLIC_IMAGE_PROXY_BASE || '').trim();
  if (base) {
    const u = new URL(base);
    u.searchParams.set('u', url);
    if (w) u.searchParams.set('w', String(w));
    if (h) u.searchParams.set('h', String(h));
    return u.toString();
  }

  // No proxy configured; return original URL
  return url;
}
