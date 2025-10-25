#!/usr/bin/env node
/*
  Ingest external restaurant images into Supabase Storage and update DB URLs.
  Requirements:
  - Node 18+
  - Env:
      SUPABASE_URL=https://<project>.supabase.co
      SUPABASE_SERVICE_ROLE_KEY=...  (service role key; treat as secret)
  Optional flags:
    --limit=200         Max rows to process (default: all)
    --concurrency=3     Max parallel image fetch/upload
    --dry               Do not write changes; just log
    --bucket=restaurant-images   Storage bucket name (default)
*/

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Lightweight .env loader (no dependency on dotenv) so the script works with a project .env file
async function loadDotEnv() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Assume project root is two levels up from scripts/ (adjust if structure changes)
    const root = path.resolve(__dirname, '..');
    const envPath = path.join(root, '.env');
    if (!fs.existsSync(envPath)) return; // no .env -> nothing to do
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Support optional "export KEY=..." style
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      let key = trimmed.slice(0, eqIdx).trim();
      if (key.toLowerCase().startsWith('export ')) key = key.slice(7).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    // ignore .env errors; fall through to existing env
  }
}

await loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. You can set them in .env or via shell environment variables.',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(name, def) {
  const pref = `--${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  if (!hit) return def;
  const v = hit.slice(pref.length);
  if (v === '') return def;
  if (name === 'dry') return true;
  if (!Number.isNaN(Number(v))) return Number(v);
  return v;
}

const LIMIT = getArg('limit', undefined);
const CONCURRENCY = Math.max(1, getArg('concurrency', 3));
const DRY = args.includes('--dry') || getArg('dry', false) === true;
const BUCKET = getArg('bucket', 'restaurant-images');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const FIRST_PARTY_SUFFIXES = ['.supabase.co', 'localhost', '127.0.0.1'];
function isFirstPartyUrl(u) {
  try {
    const p = new URL(u);
    const h = p.hostname.toLowerCase();
    return FIRST_PARTY_SUFFIXES.some((s) => h === s || h.endsWith(s));
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBucket(bucket) {
  try {
    // try to create as public; if exists, ignore error
    const { error } = await supabase.storage.createBucket(bucket, { public: true });
    if (
      error &&
      !String(error.message || '')
        .toLowerCase()
        .includes('already exists')
    ) {
      console.warn('Bucket create warning:', error.message);
    }
  } catch (e) {
    // some environments disallow bucket creation; ignore
  }
}

async function getRestaurantsBatch(from, to) {
  const sel = `place_id, restaurant_name, main_image, image_1, image_2, image_3`;
  const { data, error } = await supabase.from('restaurants').select(sel).range(from, to);
  if (error) throw error;
  return data || [];
}

async function countRestaurants() {
  const { count, error } = await supabase
    .from('restaurants')
    .select('place_id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Picky Ingest/1.0 (+https://usePicky.app)',
        Referer: new URL(url).origin,
        Accept: 'image/avif,image/webp,image/*;q=0.8,*/*;q=0.5',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const buf = await res.arrayBuffer();
    const type = res.headers.get('content-type') || 'image/jpeg';
    return { buf, type };
  } finally {
    clearTimeout(timeout);
  }
}

function extFromType(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };
  return map[type.toLowerCase()] || 'jpg';
}

async function uploadToStorage(bucket, path, arrayBuffer, contentType) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: pub.publicUrl };
}

async function updateRestaurant(place_id, patch) {
  const { error } = await supabase.from('restaurants').update(patch).eq('place_id', place_id);
  if (error) throw error;
}

function* imageFields(item) {
  yield ['main_image', item.main_image];
  yield ['image_1', item.image_1];
  yield ['image_2', item.image_2];
  yield ['image_3', item.image_3];
}

async function processItem(item) {
  const updates = {};
  for (const [field, url] of imageFields(item)) {
    if (!url || typeof url !== 'string') continue;
    if (isFirstPartyUrl(url)) continue; // already in our storage/CDN
    try {
      const { buf, type } = await fetchImage(url);
      const ext = extFromType(type);
      const safeId = encodeURIComponent(String(item.place_id));
      const path = `${safeId}/${field}.${ext}`;
      if (!DRY) {
        const { publicUrl } = await uploadToStorage(BUCKET, path, buf, type);
        updates[field] = publicUrl;
      } else {
        console.log(`[dry] would upload ${url} -> ${BUCKET}/${path}`);
      }
    } catch (e) {
      console.warn(`Skip ${item.place_id} ${field}:`, (e && e.message) || e);
    }
    // brief delay to be gentle with hosts
    await sleep(100);
  }
  if (!DRY && Object.keys(updates).length) {
    await updateRestaurant(item.place_id, updates);
    console.log(`Updated ${item.place_id}:`, Object.keys(updates).join(', '));
  }
}

async function run() {
  console.log('Starting restaurant image ingestion...');
  await ensureBucket(BUCKET);

  const total = await countRestaurants();
  const max = typeof LIMIT === 'number' ? Math.min(LIMIT, total) : total;
  const pageSize = 100;
  for (let offset = 0; offset < max; offset += pageSize) {
    const to = Math.min(offset + pageSize - 1, max - 1);
    const rows = await getRestaurantsBatch(offset, to);
    console.log(`Processing rows ${offset}-${to} (${rows.length})`);

    // Concurrency control
    let i = 0;
    const pool = new Set();
    const launch = async (row) => {
      const p = processItem(row).finally(() => pool.delete(p));
      pool.add(p);
      if (pool.size >= CONCURRENCY) await Promise.race(pool);
    };
    while (i < rows.length) {
      await launch(rows[i++]);
    }
    await Promise.all([...pool]);
  }
  console.log('Done.');
}

run().catch((e) => {
  console.error('Ingestion failed:', e);
  process.exit(1);
});
