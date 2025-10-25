// Minimal serverless proxy; avoid importing @vercel/node types to keep repo lean
export default async function handler(req: any, res: any) {
  try {
    const u = (req.query.u as string) || '';
    if (!u) return res.status(400).json({ error: 'Missing u query param' });
    let target: URL;
    try {
      target = new URL(u);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!/^https?:$/.test(target.protocol)) {
      return res.status(400).json({ error: 'Only http(s) URLs allowed' });
    }

    // Basic host denylist to prevent proxying our own API or localhost
    const h = target.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return res.status(400).json({ error: 'Localhost not allowed' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(target.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Picky Image Proxy (+https://vercel.com)',
        // Some hosts require a referer; use the target origin by default
        Referer: target.origin,
        Accept: 'image/avif,image/webp,image/*;q=0.8,*/*;q=0.5',
      },
    }).catch((err) => {
      return { ok: false, status: 504, statusText: 'Upstream Timeout', headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) } as Response;
    });
    clearTimeout(timeout);

    const status = (upstream as any).status || 502;
    const ok = (upstream as any).ok;
    const buf = await (upstream as any).arrayBuffer();
    const contentType = (upstream as any).headers?.get?.('content-type') || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    // Cache aggressively on the edge/CDN, allow stale while revalidating
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400');
    res.setHeader('CDN-Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400');
    if (!ok) res.setHeader('X-Proxy-Error', String(status));
    return res.status(ok ? 200 : status).send(Buffer.from(buf));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Proxy error' });
  }
}
