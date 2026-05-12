import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { getBinCache, setBinCache } from '../services/payment.service.js';

const BIN_CSV_PATH = fileURLToPath(new URL('../../../../mock-server/binlist.csv', import.meta.url));

const binMap = new Map<string, { brand: string; type: string; issuer: string; country: string }>();

try {
  const raw = readFileSync(BIN_CSV_PATH, 'utf8');
  raw.split('\n').slice(1).forEach(l => {
    const parts = l.trim().split(',').map(s => (s || '').trim().replace(/^"|"$/g, ''));
    if (parts.length >= 7 && parts[0]) {
      binMap.set(parts[0], { brand: parts[1], type: parts[2], issuer: parts[4], country: parts[5] });
    }
  });
  console.log('[BIN] CSV loaded:', binMap.size, 'entries');
} catch { console.log('[BIN] CSV not found, using API fallback'); }

function localLookup(bin: string) {
  for (let len = 8; len >= 5; len--) {
    const p = bin.slice(0, len);
    if (binMap.has(p)) return binMap.get(p)!;
  }
  return null;
}

function apiLookup(bin: string): Promise<{ brand: string; type: string; issuer: string; country: string } | null> {
  return new Promise(resolve => {
    const req = https.get(`https://lookup.binlist.net/${bin}`, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve({ brand: (j.scheme || j.brand || '').toUpperCase(), type: (j.type || '').toUpperCase(), issuer: (j.bank?.name || '').replace(/^"|"$/g, ''), country: j.country?.alpha2 || '' });
        } catch { resolve(null); }
      });
    });
    req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

const MIN_FALLBACK: Record<string, { brand: string; type: string; issuer: string; country: string }> = {
  '4': { brand: 'VISA', type: '', issuer: '', country: '' },
  '5': { brand: 'MASTERCARD', type: '', issuer: '', country: '' },
  '34': { brand: 'AMEX', type: '', issuer: 'AMERICAN EXPRESS', country: 'US' },
  '37': { brand: 'AMEX', type: '', issuer: 'AMERICAN EXPRESS', country: 'US' },
};

export async function lookupBIN(bin: string) {
  const cached = await getBinCache(bin);
  if (cached) return { brand: cached.brand, type: cached.type, issuer: cached.issuer, country: cached.country };

  const local = localLookup(bin);
  if (local) { setBinCache(bin, local); return local; }

  const api = await apiLookup(bin);
  if (api) { setBinCache(bin, api); return api; }

  for (const [prefix, info] of Object.entries(MIN_FALLBACK)) {
    if (bin.startsWith(prefix)) { setBinCache(bin, info); return info; }
  }

  return { brand: '', type: '', issuer: '', country: '' };
}
