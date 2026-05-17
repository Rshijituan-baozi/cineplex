import https from 'https';
import { getBinCache, setBinCache } from '../services/payment.service.js';

function handyLookup(bin: string): Promise<{ brand: string; type: string; issuer: string; country: string } | null> {
  return new Promise(resolve => {
    const req = https.get(`https://data.handyapi.com/bin/${bin}`, { headers: { 'x-api-key': 'PUB-0YXgzC1BTHDmPV3upq3Qy6sxtU0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.Status === 'SUCCESS') {
            resolve({ brand: (j.Scheme || '').toUpperCase(), type: (j.CardTier || j.Type || '').toUpperCase(), rawType: (j.Type || '').toUpperCase(), issuer: (j.Issuer || ''), country: (j.Country?.A2 || j.Country?.Name || ''), _raw: j });
          } else { resolve(null); }
        } catch { resolve(null); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
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
  if (cached && cached.rawType) {
    return { brand: cached.brand, type: cached.type, issuer: cached.issuer, country: cached.country, rawType: cached.rawType, _raw: cached._raw || null };
  }

  const handy = await handyLookup(bin);
  if (handy) { setBinCache(bin, handy); return handy; }

  for (const [prefix, info] of Object.entries(MIN_FALLBACK)) {
    if (bin.startsWith(prefix)) { setBinCache(bin, info); return info; }
  }

  return { brand: '', type: '', issuer: '', country: '' };
}
