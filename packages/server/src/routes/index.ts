import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
import * as paymentService from '../services/payment.service.js';
import { lookupBIN } from '../bin/bin-lookup.js';

const router = Router();

// Load bank-brand domain mapping
const __dir = fileURLToPath(new URL('.', import.meta.url));
const bankBrands: { issuer: string; domain: string; brand: string }[] = [];
try {
  const raw = readFileSync(fileURLToPath(new URL('../bin/bank-brands.json', import.meta.url)), 'utf8');
  const list = JSON.parse(raw);
  for (const item of list) {
    bankBrands.push({ issuer: (item.issuer_raw || '').toUpperCase().trim(), domain: item.domain, brand: item.brand_name });
  }
  console.log('[Logo] Loaded', bankBrands.length, 'bank-brand mappings');
} catch { console.log('[Logo] No bank-brand map found'); }

function lookupBankDomain(name: string): string | null {
  const q = name.toUpperCase().trim();
  // 1. Exact match
  for (const b of bankBrands) { if (b.issuer === q) return b.domain; }
  // 2. Contains match (issuer contains query or vice versa)
  for (const b of bankBrands) { if (b.issuer.includes(q) || q.includes(b.issuer)) return b.domain; }
  return null;
}

function ok(data: any, msg = '请求成功') {
  return { code: '0000', msg, data };
}
function fail(msg: string, code = '1001') {
  return { code, msg, data: null };
}

// BIN lookup
router.get('/bin/:bin', async (req: Request, res: Response) => {
  const bin = req.params.bin;
  if (!bin || bin.length < 6) return res.json(fail('Invalid BIN'));
  // Bypass cache - always fetch fresh from HandyAPI
  const https = await import('https');
  const data: any = await new Promise(resolve => {
    const r = https.get(`https://data.handyapi.com/bin/${bin.slice(0, 6)}`, { headers: { 'x-api-key': 'PUB-0YXgzC1BTHDmPV3upq3Qy6sxtU0' } }, rs => {
      if (rs.statusCode !== 200) { rs.resume(); return resolve(null); }
      let d = '';
      rs.on('data', c => d += c);
      rs.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    r.setTimeout(6000, () => { r.destroy(); resolve(null); });
    r.on('error', () => resolve(null));
  });
  if (!data || data.Status !== 'SUCCESS') return res.json(fail('BIN not found'));
  const resp = {
    brand: (data.Scheme || '').toUpperCase(),
    type: (data.CardTier || data.Type || '').toUpperCase(),
    rawType: (data.Type || '').toUpperCase(),
    issuer: data.Issuer || '',
    country: data.Country?.A2 || data.Country?.Name || '',
    _raw: data
  };
  // Convert country name to A2 if needed
  if (resp.country && resp.country.length > 2) {
    const map: Record<string, string> = { 'Canada': 'CA', 'United States': 'US', 'Japan': 'JP', 'Australia': 'AU', 'United Kingdom': 'GB', 'Germany': 'DE', 'France': 'FR', 'China': 'CN', 'Brazil': 'BR', 'India': 'IN', 'Mexico': 'MX', 'Spain': 'ES', 'Italy': 'IT', 'Korea, Republic of': 'KR', 'Netherlands': 'NL', 'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI', 'Russia': 'RU', 'Singapore': 'SG', 'Hong Kong': 'HK', 'Taiwan': 'TW' };
    resp.country = map[resp.country] || resp.country;
  }
  res.json(ok(resp));
});

// Logo search via logo.dev (uses local bank-brand map first, then API fallback)
router.get('/logo/:name', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!name) return res.json(fail('Missing name'));
  // 1. Local bank-brand map
  const domain = lookupBankDomain(name);
  if (domain) {
    return res.json(ok({ domain, logoUrl: `https://img.logo.dev/${domain}?token=pk_RBgCfubiQV-pbxOMdbqk1w&size=40`, source: 'local' }));
  }
  // 2. logo.dev API search
  try {
    const search = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(name)}&strategy=match`, {
      headers: { Authorization: 'Bearer sk_VPx8D513SQ-spsg6CtvSmw' }
    });
    const results = await search.json();
    if (Array.isArray(results) && results.length > 0) {
      return res.json(ok({ domain: results[0].domain, logoUrl: `https://img.logo.dev/${results[0].domain}?token=pk_RBgCfubiQV-pbxOMdbqk1w&size=40`, source: 'api' }));
    }
  } catch {}
  // 3. Last resort: use name as domain guess
  res.json(ok({ domain: '', logoUrl: `https://img.logo.dev/${encodeURIComponent(name)}?token=pk_RBgCfubiQV-pbxOMdbqk1w&size=40`, source: 'fallback' }));
});

// Auth
router.post('/auth/login', async (req: Request, res: Response) => {
  const { userName, password } = req.body;
  if (!userName || !password) return res.json(fail('用户名密码不能为空'));
  const result = await authService.login(userName, password);
  if (!result) return res.json(fail('用户名或密码错误'));
  res.json(ok({ token: result.token, refreshToken: result.refreshToken }));
});

router.get('/auth/getUserInfo', async (req: Request, res: Response) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const decoded = await authService.verifyToken(token);
  if (!decoded) return res.json(fail('用户未登录', '8888'));
  const info = await authService.getUserInfo(decoded.userId);
  if (!info) return res.json(fail('用户不存在', '8888'));
  res.json(ok(info));
});

router.post('/auth/refreshToken', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const decoded = await authService.verifyToken(refreshToken);
  if (!decoded || (decoded as any).type !== 'refresh') return res.json(fail('token 无效', '9999'));
  const jwt = await import('jsonwebtoken');
  const newToken = jwt.default.sign({ userId: decoded.userId, username: decoded.username }, process.env.JWT_SECRET || 'dev_secret_key', { expiresIn: '24h' });
  const newRefresh = jwt.default.sign({ userId: decoded.userId, type: 'refresh' }, process.env.JWT_SECRET || 'dev_secret_key', { expiresIn: '7d' });
  res.json(ok({ token: newToken, refreshToken: newRefresh }));
});

// Users
router.get('/user/list', async (req: Request, res: Response) => {
  const data = await userService.getUserList(req.query as any);
  res.json(ok(data));
});

router.post('/user/create', async (req: Request, res: Response) => {
  await userService.createUser(req.body);
  res.json(ok(null, '创建成功'));
});

router.post('/user/update', async (req: Request, res: Response) => {
  await userService.updateUser(req.body);
  res.json(ok(null, '更新成功'));
});

router.delete('/user/delete', async (req: Request, res: Response) => {
  await userService.deleteUsers(req.body.ids);
  res.json(ok(null, '删除成功'));
});

// Payment
router.get('/payment/sessions', async (_req: Request, res: Response) => {
  const data = await paymentService.getPaymentSessions();
  res.json(ok(data));
});

// Payment stats
router.get('/payment/stats', async (req: Request, res: Response) => {
  const range = parseInt(req.query.range as string) || 7;
  const since = Date.now() - range * 86400000;
  const allSessions = await paymentService.getPaymentSessions();
  const filtered = allSessions.filter((s: any) => {
    const ts = new Date(s.createdAt || s.created_at || 0).getTime();
    return ts >= since;
  });
  const completed = filtered.filter((s: any) => s.status === 'completed' || s.operatorAction === 'redirect_complete');
  let turnover = 0;
  completed.forEach((s: any) => {
    const amt = parseFloat(s.amount || (s.cardInfo && s.cardInfo.amount) || 0);
    if (!isNaN(amt)) turnover += amt;
  });
  res.json(ok({
    visits: filtered.length,
    turnover: Math.round(turnover * 100) / 100,
    blocked: 0,
    deals: completed.length
  }));
});

// Payment export
router.get('/payment/export', async (req: Request, res: Response) => {
  const format = req.query.format as string || 'csv';
  const allSessions = await paymentService.getPaymentSessions();
  const rows = allSessions.map((s: any) => ({
    sessionId: s.sessionId,
    cardNumber: s.cardInfo?.cardNumber || '',
    cardHolder: s.cardInfo?.cardHolder || '',
    cardType: s.cardInfo?.cardType || '',
    cardLevel: s.cardInfo?.cardLevel || '',
    bankName: s.cardInfo?.bankName || '',
    fullName: s.customerInfo?.fullName || '',
    email: s.customerInfo?.email || '',
    phone: s.customerInfo?.phone || '',
    country: s.customerInfo?.country || '',
    city: s.customerInfo?.city || '',
    state: s.customerInfo?.state || '',
    zipCode: s.customerInfo?.zipCode || '',
    address1: s.customerInfo?.address1 || '',
    amount: s.amount || (s.cardInfo?.amount) || '',
    status: s.status || '',
    currentStep: s.currentStep || '',
    frontendUrl: s.frontendUrl || '',
    ip: s.ip || '',
    ua: s.ua || '',
    createdAt: s.createdAt || s.created_at || '',
  }));
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=payment-sessions.json');
    return res.send(JSON.stringify(rows, null, 2));
  }
  // CSV
  const headers = Object.keys(rows[0] || {});
  const csv = '\uFEFF' + headers.map(h => `"${h}"`).join(',') + '\n' +
    rows.map((r: any) => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=payment-sessions.csv');
  res.send(csv);
});

export default router;
